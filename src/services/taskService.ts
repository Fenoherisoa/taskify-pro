import { pool } from './database';
import { TaskRecord, TaskStatus } from '../types';
import { getOrCreateUser } from './userService';
import { syncTaskToGoogleSheets } from './sheetsService';
import { logAudit } from './auditService';
import { createNotification } from './notificationService';

/**
 * Maps a database row from `tasks` (optionally joined with `users`) into a frontend `TaskRecord`
 */
export function mapDbTaskToRecord(row: any): TaskRecord {
  return {
    id: row.task_id || `task-${row.id}`,
    uid: row.uid || '',
    cookies: row.cookies || '',
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    password: row.password || '',
    telegramUserId: row.telegram_user_id || '',
    telegramUsername: row.telegram_username || 'anonyme',
    status: (row.status || 'pending') as TaskStatus,
    validationStatus: row.validation_status || 'pending',
    validationReason: row.validation_reason || null,
    validatedAt: row.validated_at ? new Date(row.validated_at).toISOString() : null,
    validatedBy: row.validated_by || null,
    rewardUSD: Number(row.reward_usd ?? 0.04),
    rewardPaid: Boolean(row.reward_paid),
    accountCreated: Boolean(row.account_created),
    notes: row.validation_reason || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.completed_at ? new Date(row.completed_at).toISOString() : new Date().toISOString(),
    syncedToGoogleSheets: false,
    taskType: row.task_type || 'Facebook'
  };
}

/**
 * Fetch all tasks from PostgreSQL (with optional filter)
 */
export async function getAllTasks(filterStatus?: string): Promise<TaskRecord[]> {
  try {
    let query = `
      SELECT 
        t.*,
        u.telegram_username
      FROM tasks t
      LEFT JOIN users u ON u.telegram_user_id = t.telegram_user_id
    `;
    const params: any[] = [];

    if (filterStatus && filterStatus !== 'all') {
      if (filterStatus === 'pending') {
        query += ` WHERE t.validation_status = 'pending' OR t.status = 'en attente' OR t.status = 'pending'`;
      } else if (filterStatus === 'validated') {
        query += ` WHERE t.validation_status = 'validated' OR t.status = 'compte créé' OR t.status = 'vérifié'`;
      } else if (filterStatus === 'rejected') {
        query += ` WHERE t.validation_status = 'rejected' OR t.status = 'annulé'`;
      } else {
        query += ` WHERE t.status = $1`;
        params.push(filterStatus);
      }
    }

    query += ` ORDER BY t.id DESC LIMIT 300`;

    const result = await pool.query(query, params);
    return result.rows.map(mapDbTaskToRecord);
  } catch (err: any) {
    console.error('❌ Failed to fetch tasks from PostgreSQL:', err.message);
    return [];
  }
}

/**
 * Create a new task in PostgreSQL
 */
export async function createTask(data: {
  taskId?: string;
  telegramUserId: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  cookies?: string;
  uid: string;
  taskType?: string;
  notes?: string;
  status?: string;
  rewardUSD?: number;
}): Promise<TaskRecord> {
  const taskId = data.taskId || `task-${Date.now()}`;
  const status = data.status || 'pending';
  const rewardUSD = data.rewardUSD ?? 0.04;

  // Ensure user exists
  await getOrCreateUser(
    data.telegramUserId,
    data.telegramUsername,
    data.firstName,
    data.lastName
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertResult = await client.query(
      `
      INSERT INTO tasks (
        task_id,
        telegram_user_id,
        task_type,
        status,
        uid,
        first_name,
        last_name,
        password,
        cookies,
        reward_usd,
        validation_status,
        validation_reason,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING *
      `,
      [
        taskId,
        data.telegramUserId,
        data.taskType || 'Facebook',
        status,
        data.uid,
        data.firstName || '',
        data.lastName || '',
        data.password || '',
        data.cookies || '',
        rewardUSD,
        'pending',
        data.notes || null
      ]
    );

    await client.query('COMMIT');

    const createdRecord = mapDbTaskToRecord({
      ...insertResult.rows[0],
      telegram_username: data.telegramUsername
    });

    // Async sync to Google Sheets
    syncTaskToGoogleSheets(createdRecord).catch(() => {});

    // Audit log
    logAudit('create_task', data.telegramUserId, {
      taskId,
      uid: data.uid,
      taskType: data.taskType
    }).catch(() => {});

    return createdRecord;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to insert task in PostgreSQL:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Validate task (Admin action)
 * Marks task validated, credits user wallet, creates account record, records validation, logs audit.
 */
export async function validateTask(
  taskId: string,
  validatorId: string = 'admin',
  reason: string = 'Validé par administrateur'
): Promise<TaskRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch task
    const taskRes = await client.query(
      `SELECT * FROM tasks WHERE task_id = $1 OR id::text = $1 FOR UPDATE`,
      [taskId]
    );

    if (taskRes.rows.length === 0) {
      throw new Error(`Tâche ${taskId} introuvable`);
    }

    const task = taskRes.rows[0];
    const actualTaskId = task.task_id;
    const reward = Number(task.reward_usd || 0.04);
    const tgUserId = task.telegram_user_id;

    // 2. Update task record
    const updatedTaskRes = await client.query(
      `
      UPDATE tasks
      SET
        status = 'compte créé',
        validation_status = 'validated',
        validation_reason = $1,
        validated_at = NOW(),
        validated_by = $2,
        account_created = TRUE,
        account_created_at = NOW(),
        reward_paid = TRUE,
        reward_paid_at = NOW(),
        completed_at = NOW()
      WHERE task_id = $3
      RETURNING *
      `,
      [reason, validatorId, actualTaskId]
    );

    // 3. Upsert account record
    if (task.uid) {
      await client.query(
        `
        INSERT INTO accounts (task_id, uid, first_name, last_name, account_status, validated_at)
        VALUES ($1, $2, $3, $4, 'active', NOW())
        ON CONFLICT (task_id) DO UPDATE
        SET account_status = 'active', validated_at = NOW()
        `,
        [actualTaskId, task.uid, task.first_name, task.last_name]
      );
    }

    // 4. Record task_validations
    await client.query(
      `
      INSERT INTO task_validations (task_id, validator_id, status, reason, validated_at)
      VALUES ($1, $2, 'validated', $3, NOW())
      `,
      [actualTaskId, validatorId, reason]
    );

    // 5. Credit user's wallet if reward not already paid
    if (!task.reward_paid && tgUserId) {
      // Find user internal id
      const userRes = await client.query(
        `SELECT id FROM users WHERE telegram_user_id = $1`,
        [tgUserId]
      );

      if (userRes.rows.length > 0) {
        const userId = userRes.rows[0].id;

        // Ensure wallet exists
        await client.query(
          `INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );

        // Lock & get wallet balance
        const walletRes = await client.query(
          `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
          [userId]
        );

        const currentBal = Number(walletRes.rows[0]?.balance || 0);
        const newBal = currentBal + reward;

        await client.query(
          `
          UPDATE wallets
          SET
            balance = balance + $1,
            total_earned = total_earned + $1,
            updated_at = NOW()
          WHERE user_id = $2
          `,
          [reward, userId]
        );

        // Record transaction
        await client.query(
          `
          INSERT INTO transactions (
            user_id, task_id, type, amount, balance_before, balance_after, description
          )
          VALUES ($1, $2, 'task_reward', $3, $4, $5, $6)
          `,
          [
            userId,
            actualTaskId,
            reward,
            currentBal,
            newBal,
            `Validation tâche ${actualTaskId}`
          ]
        );
      }
    }

    await client.query('COMMIT');

    const updatedTask = mapDbTaskToRecord(updatedTaskRes.rows[0]);

    // Send in-app notification to user
    if (tgUserId) {
      pool.query(`SELECT id FROM users WHERE telegram_user_id = $1`, [tgUserId]).then(uRes => {
        if (uRes.rows.length > 0) {
          createNotification(
            uRes.rows[0].id,
            'Tâche validée ! 🎉',
            `Félicitations ! Votre tâche ${actualTaskId} a été validée. Une rémunération de $${reward.toFixed(2)} USD a été créditée sur votre portefeuille.`,
            'reward'
          ).catch(() => {});
        }
      }).catch(() => {});
    }

    // Sync to Google Sheets
    syncTaskToGoogleSheets(updatedTask).catch(() => {});

    // Audit log
    logAudit('validate_task', validatorId, {
      taskId: actualTaskId,
      reward,
      telegramUserId: tgUserId
    }).catch(() => {});

    return updatedTask;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error validating task in PostgreSQL:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reject task (Admin action)
 * Marks task rejected with reason, records in task_validations, logs audit, updates Google Sheets.
 */
export async function rejectTask(
  taskId: string,
  validatorId: string = 'admin',
  reason: string = 'Rejeté par administrateur'
): Promise<TaskRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const taskRes = await client.query(
      `SELECT * FROM tasks WHERE task_id = $1 OR id::text = $1 FOR UPDATE`,
      [taskId]
    );

    if (taskRes.rows.length === 0) {
      throw new Error(`Tâche ${taskId} introuvable`);
    }

    const task = taskRes.rows[0];
    const actualTaskId = task.task_id;

    const updatedTaskRes = await client.query(
      `
      UPDATE tasks
      SET
        status = 'annulé',
        validation_status = 'rejected',
        validation_reason = $1,
        validated_at = NOW(),
        validated_by = $2,
        reward_paid = FALSE,
        completed_at = NOW()
      WHERE task_id = $3
      RETURNING *
      `,
      [reason, validatorId, actualTaskId]
    );

    // Record validation report
    await client.query(
      `
      INSERT INTO task_validations (task_id, validator_id, status, reason, validated_at)
      VALUES ($1, $2, 'rejected', $3, NOW())
      `,
      [actualTaskId, validatorId, reason]
    );

    await client.query('COMMIT');

    const updatedTask = mapDbTaskToRecord(updatedTaskRes.rows[0]);

    // Send in-app notification to user
    if (task.telegram_user_id) {
      pool.query(`SELECT id FROM users WHERE telegram_user_id = $1`, [task.telegram_user_id]).then(uRes => {
        if (uRes.rows.length > 0) {
          createNotification(
            uRes.rows[0].id,
            'Tâche refusée ❌',
            `Votre tâche ${actualTaskId} a été rejetée. Motif : ${reason}`,
            'warning'
          ).catch(() => {});
        }
      }).catch(() => {});
    }

    // Sync to Google Sheets
    syncTaskToGoogleSheets(updatedTask).catch(() => {});

    // Audit log
    logAudit('reject_task', validatorId, {
      taskId: actualTaskId,
      reason
    }).catch(() => {});

    return updatedTask;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error rejecting task in PostgreSQL:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update task status (e.g. mark suspended or active)
 */
export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  notes?: string,
  actorId: string = 'admin'
): Promise<TaskRecord> {
  try {
    const res = await pool.query(
      `
      UPDATE tasks
      SET
        status = $1,
        validation_reason = COALESCE($2, validation_reason),
        completed_at = NOW()
      WHERE task_id = $3 OR id::text = $3
      RETURNING *
      `,
      [newStatus, notes || null, taskId]
    );

    if (res.rows.length === 0) {
      throw new Error(`Tâche ${taskId} introuvable`);
    }

    const updated = mapDbTaskToRecord(res.rows[0]);
    syncTaskToGoogleSheets(updated).catch(() => {});

    logAudit('update_task_status', actorId, {
      taskId,
      newStatus,
      notes
    }).catch(() => {});

    return updated;
  } catch (err) {
    console.error('❌ Error updating task status in PostgreSQL:', err);
    throw err;
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string, actorId: string = 'admin'): Promise<boolean> {
  try {
    const res = await pool.query(
      `DELETE FROM tasks WHERE task_id = $1 OR id::text = $1 RETURNING id`,
      [taskId]
    );

    if (res.rows.length > 0) {
      logAudit('delete_task', actorId, { taskId }).catch(() => {});
      return true;
    }
    return false;
  } catch (err) {
    console.error('❌ Error deleting task from PostgreSQL:', err);
    throw err;
  }
}

/**
 * Get tasks for a specific user (Bot & Mini App)
 */
export async function getUserTasks(telegramUserId: string | number): Promise<TaskRecord[]> {
  try {
    const res = await pool.query(
      `
      SELECT t.*, u.telegram_username
      FROM tasks t
      LEFT JOIN users u ON u.telegram_user_id = t.telegram_user_id
      WHERE t.telegram_user_id = $1
      ORDER BY t.id DESC
      LIMIT 100
      `,
      [String(telegramUserId)]
    );

    return res.rows.map(mapDbTaskToRecord);
  } catch (err: any) {
    console.error('❌ Error fetching user tasks:', err.message);
    return [];
  }
}

