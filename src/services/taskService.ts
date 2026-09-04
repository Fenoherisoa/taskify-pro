/**
 * ============================================================
 * TASKIFY PRO - TASK & VERIFICATION SERVICE
 * ============================================================
 * Handles task creation, verification (Admin & Bot check),
 * reward credits with transaction-level anti-double-spend locks,
 * Google Sheets synchronization, and audit logging.
 */

import { pool } from './database';
import {
  TaskRecord,
  TaskStatus,
  AccountStatus,
  VerificationStatus,
  VerificationMethod,
  VerificationResult
} from '../types';
import { getOrCreateUser } from './userService';
import { syncTaskToGoogleSheets } from './sheetsService';
import { logAudit } from './auditService';
import { createNotification, sendTelegramVerificationMessage } from './notificationService';
import { checkFacebookUid } from './facebookCheckerService';
import { INITIAL_TASKS } from '../data/mockTasks';

/**
 * Maps a database row from `tasks` (optionally joined with `users`) into a frontend `TaskRecord`
 */
export function mapDbTaskToRecord(row: any): TaskRecord {
  // Infer account status if empty
  let accountStatus: AccountStatus = (row.account_status as AccountStatus) || 'pending_verification';
  if (!row.account_status) {
    if (row.status === 'compte créé' || row.status === 'vérifié' || row.validation_status === 'validated') {
      accountStatus = 'verified';
    } else if (row.status === 'compte suspendu' || row.status === 'annulé' || row.validation_status === 'rejected') {
      accountStatus = 'suspended';
    } else {
      accountStatus = 'pending_verification';
    }
  }

  let verificationStatus: VerificationStatus = (row.verification_status as VerificationStatus) || 'pending';
  if (!row.verification_status) {
    if (row.validation_status === 'validated' || accountStatus === 'verified') {
      verificationStatus = 'verified';
    } else if (row.validation_status === 'rejected' || accountStatus === 'suspended') {
      verificationStatus = 'rejected';
    } else {
      verificationStatus = 'pending';
    }
  }

  let verificationMethod: VerificationMethod = (row.verification_method as VerificationMethod) || 'NONE';
  if (!row.verification_method || row.verification_method === 'NONE') {
    if (row.validated_by && row.validated_by.toUpperCase().includes('BOT')) {
      verificationMethod = 'BOT';
    } else if (row.validated_by) {
      verificationMethod = 'ADMIN';
    }
  }

  let verificationResult: VerificationResult = (row.verification_result as VerificationResult) || 'PENDING';
  if (!row.verification_result || row.verification_result === 'PENDING') {
    if (verificationStatus === 'verified') {
      verificationResult = 'GREEN';
    } else if (verificationStatus === 'rejected') {
      verificationResult = 'RED';
    }
  }

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
    accountStatus,
    verificationStatus,
    verificationMethod,
    verificationResult,
    validationStatus: row.validation_status || 'pending',
    validationReason: row.verification_reason || row.validation_reason || null,
    validatedAt: row.verified_at ? new Date(row.verified_at).toISOString() : (row.validated_at ? new Date(row.validated_at).toISOString() : null),
    validatedBy: row.verified_by || row.validated_by || null,
    rewardUSD: Number(row.reward_usd ?? 0.04),
    rewardPaid: Boolean(row.reward_paid),
    rewardPaidAt: row.reward_paid_at ? new Date(row.reward_paid_at).toISOString() : null,
    accountCreated: Boolean(row.account_created),
    notes: row.verification_reason || row.validation_reason || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.completed_at ? new Date(row.completed_at).toISOString() : (row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()),
    syncedToGoogleSheets: Boolean(row.synced_to_sheets),
    taskType: row.task_type || 'Facebook'
  };
}

/**
 * Fetch all tasks from PostgreSQL (with comprehensive status and method filters)
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
      switch (filterStatus) {
        case 'pending_verification':
        case 'pending':
          query += ` WHERE t.account_status = 'pending_verification' OR (t.account_status IS NULL AND (t.validation_status = 'pending' OR t.status = 'en attente' OR t.status = 'pending'))`;
          break;
        case 'verified':
          query += ` WHERE t.account_status = 'verified' OR t.verification_status = 'verified' OR t.validation_status = 'validated'`;
          break;
        case 'suspended':
          query += ` WHERE t.account_status = 'suspended' OR t.verification_status = 'rejected' OR t.validation_status = 'rejected'`;
          break;
        case 'bot_verified':
          query += ` WHERE (t.verification_method = 'BOT' OR t.validated_by ILIKE '%bot%') AND (t.account_status = 'verified' OR t.verification_status = 'verified' OR t.validation_status = 'validated')`;
          break;
        case 'bot_rejected':
          query += ` WHERE (t.verification_method = 'BOT' OR t.validated_by ILIKE '%bot%') AND (t.account_status = 'suspended' OR t.verification_status = 'rejected' OR t.validation_status = 'rejected')`;
          break;
        case 'admin_verified':
          query += ` WHERE (t.verification_method = 'ADMIN' OR (t.verification_method != 'BOT' AND (t.validated_by IS NOT NULL AND t.validated_by NOT ILIKE '%bot%'))) AND (t.account_status = 'verified' OR t.verification_status = 'verified' OR t.validation_status = 'validated')`;
          break;
        case 'admin_rejected':
          query += ` WHERE (t.verification_method = 'ADMIN' OR (t.verification_method != 'BOT' AND (t.validated_by IS NOT NULL AND t.validated_by NOT ILIKE '%bot%'))) AND (t.account_status = 'suspended' OR t.verification_status = 'rejected' OR t.validation_status = 'rejected')`;
          break;
        default:
          query += ` WHERE t.status = $1 OR t.account_status = $1`;
          params.push(filterStatus);
          break;
      }
    }

    query += ` ORDER BY t.id DESC LIMIT 500`;

    const result = await pool.query(query, params);
    return result.rows.map(mapDbTaskToRecord);
  } catch (err: any) {
    console.error('❌ Failed to fetch tasks from PostgreSQL:', err.message);
    return [];
  }
}

/**
 * Create a new task in PostgreSQL.
 * Newly created Facebook accounts start in "Pending Verification" state.
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
  skipAutoCheck?: boolean;
}): Promise<TaskRecord> {
  const taskId = data.taskId || `task-${Date.now()}`;
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
        account_status,
        verification_status,
        verification_method,
        verification_result,
        uid,
        first_name,
        last_name,
        password,
        cookies,
        reward_usd,
        validation_status,
        validation_reason,
        reward_paid,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, 'pending_verification', 'pending', 'NONE', 'PENDING',
        $5, $6, $7, $8, $9, $10, 'pending', $11, FALSE, NOW()
      )
      RETURNING *
      `,
      [
        taskId,
        data.telegramUserId,
        data.taskType || 'Facebook',
        'pending',
        data.uid,
        data.firstName || '',
        data.lastName || '',
        data.password || '',
        data.cookies || '',
        rewardUSD,
        data.notes || 'En attente de vérification'
      ]
    );

    // Initial account record
    if (data.uid) {
      await client.query(
        `
        INSERT INTO accounts (task_id, uid, first_name, last_name, account_status)
        VALUES ($1, $2, $3, $4, 'pending_verification')
        ON CONFLICT (task_id) DO UPDATE
        SET account_status = 'pending_verification'
        `,
        [taskId, data.uid, data.firstName || '', data.lastName || '']
      );
    }

    await client.query('COMMIT');

    const createdRecord = mapDbTaskToRecord({
      ...insertResult.rows[0],
      telegram_username: data.telegramUsername
    });

    // Async sync to Google Sheets (row updated with Task ID)
    syncTaskToGoogleSheets(createdRecord).catch(() => {});

    // Audit log
    logAudit('create_task', data.telegramUserId, {
      taskId,
      uid: data.uid,
      accountStatus: 'pending_verification'
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
 * Validate task (Admin or Bot action)
 * Marks account verified, task validated, credits user wallet atomically, creates account record, records validation, logs audit, and notifies user.
 * 
 * IMPORTANT: Strictly prevents duplicate validation and duplicate rewards using row-level locking.
 */
export async function validateTask(
  taskId: string,
  validatorId: string = 'admin',
  reason: string = 'Compte validé',
  method: VerificationMethod = 'ADMIN'
): Promise<TaskRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch task with exclusive row-level lock
    let taskRes = await client.query(
      `SELECT * FROM tasks WHERE task_id = $1 OR id::text = $1 FOR UPDATE`,
      [taskId]
    );

    if (taskRes.rows.length === 0) {
      const mock = INITIAL_TASKS.find(t => t.id === taskId);
      if (mock) {
        await client.query(
          `
          INSERT INTO tasks (
            task_id, telegram_user_id, task_type, status, account_status,
            verification_status, verification_method, verification_result,
            uid, first_name, last_name, password, cookies, reward_usd,
            validation_status, validation_reason, reward_paid, created_at
          ) VALUES (
            $1, $2, $3, 'pending', 'pending_verification',
            'pending', 'NONE', 'PENDING',
            $4, $5, $6, $7, $8, $9,
            'pending', $10, FALSE, NOW()
          )
          ON CONFLICT (task_id) DO NOTHING
          `,
          [
            mock.id,
            mock.telegramUserId || '589234102',
            mock.taskType || 'Facebook',
            mock.uid || '',
            mock.firstName || '',
            mock.lastName || '',
            mock.password || '',
            mock.cookies || '',
            mock.rewardUSD ?? 0.04,
            mock.notes || 'Créé depuis les tâches initiales'
          ]
        );
        taskRes = await client.query(
          `SELECT * FROM tasks WHERE task_id = $1 OR id::text = $1 FOR UPDATE`,
          [taskId]
        );
      }
    }

    if (taskRes.rows.length === 0) {
      throw new Error(`Tâche ${taskId} introuvable`);
    }

    const task = taskRes.rows[0];
    const actualTaskId = task.task_id;
    const reward = Number(task.reward_usd || 0.04);
    const tgUserId = task.telegram_user_id;

    // RULE 4: Prevent duplicate validation & duplicate rewards!
    if (task.reward_paid && task.account_status === 'verified') {
      await client.query('COMMIT');
      console.log(`ℹ️ Task ${actualTaskId} already verified and rewarded. Skipping duplicate credit.`);
      return mapDbTaskToRecord(task);
    }

    // 2. Update task record
    const updatedTaskRes = await client.query(
      `
      UPDATE tasks
      SET
        account_status = 'verified',
        verification_status = 'verified',
        verification_method = $1,
        verification_result = 'GREEN',
        verification_reason = $2,
        status = 'compte créé',
        validation_status = 'validated',
        validation_reason = $2,
        validated_at = NOW(),
        verified_at = NOW(),
        validated_by = $3,
        verified_by = $3,
        account_created = TRUE,
        account_created_at = COALESCE(account_created_at, NOW()),
        reward_paid = TRUE,
        reward_paid_at = NOW(),
        completed_at = NOW()
      WHERE task_id = $4
      RETURNING *
      `,
      [method, reason, validatorId, actualTaskId]
    );

    // 3. Upsert account record
    if (task.uid) {
      await client.query(
        `
        INSERT INTO accounts (task_id, uid, first_name, last_name, account_status, validated_at)
        VALUES ($1, $2, $3, $4, 'verified', NOW())
        ON CONFLICT (task_id) DO UPDATE
        SET account_status = 'verified', validated_at = NOW()
        `,
        [actualTaskId, task.uid, task.first_name, task.last_name]
      );
    }

    // 4. Record task_validations history
    await client.query(
      `
      INSERT INTO task_validations (task_id, validator_id, status, reason, validated_at)
      VALUES ($1, $2, 'validated', $3, NOW())
      `,
      [actualTaskId, validatorId, reason]
    );

    let newBalance = 0;

    // 5. Credit user's wallet with exclusive lock (anti-double-spend)
    if (!task.reward_paid && tgUserId) {
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
        newBalance = currentBal + reward;

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
            newBalance,
            `Rémunération tâche ${actualTaskId} (${method})`
          ]
        );
      }
    } else if (tgUserId) {
      // Reward already paid, fetch current balance
      const wRes = await client.query(
        `SELECT w.balance FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.telegram_user_id = $1`,
        [tgUserId]
      );
      newBalance = Number(wRes.rows[0]?.balance || 0);
    }

    await client.query('COMMIT');

    const updatedTask = mapDbTaskToRecord(updatedTaskRes.rows[0]);

    // Send user notification in their language
    if (tgUserId) {
      sendTelegramVerificationMessage(tgUserId, {
        isAccepted: true,
        isBot: method === 'BOT',
        rewardUSD: reward,
        currentBalance: newBalance,
        reason
      }).catch(err => console.warn('⚠️ Notification error on task validation:', err));
    }

    // Sync to Google Sheets (row updated with task ID)
    syncTaskToGoogleSheets(updatedTask).catch(() => {});

    // Audit log
    logAudit('validate_task', validatorId, {
      taskId: actualTaskId,
      reward,
      method,
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
 * Reject task (Admin or Bot action)
 * Marks account suspended, task rejected, does NOT credit wallet, records validation history, logs audit, and notifies user.
 */
export async function rejectTask(
  taskId: string,
  validatorId: string = 'admin',
  reason: string = 'Rejeté par administrateur',
  method: VerificationMethod = 'ADMIN'
): Promise<TaskRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let taskRes = await client.query(
      `SELECT * FROM tasks WHERE task_id = $1 OR id::text = $1 FOR UPDATE`,
      [taskId]
    );

    if (taskRes.rows.length === 0) {
      const mock = INITIAL_TASKS.find(t => t.id === taskId);
      if (mock) {
        await client.query(
          `
          INSERT INTO tasks (
            task_id, telegram_user_id, task_type, status, account_status,
            verification_status, verification_method, verification_result,
            uid, first_name, last_name, password, cookies, reward_usd,
            validation_status, validation_reason, reward_paid, created_at
          ) VALUES (
            $1, $2, $3, 'pending', 'pending_verification',
            'pending', 'NONE', 'PENDING',
            $4, $5, $6, $7, $8, $9,
            'pending', $10, FALSE, NOW()
          )
          ON CONFLICT (task_id) DO NOTHING
          `,
          [
            mock.id,
            mock.telegramUserId || '589234102',
            mock.taskType || 'Facebook',
            mock.uid || '',
            mock.firstName || '',
            mock.lastName || '',
            mock.password || '',
            mock.cookies || '',
            mock.rewardUSD ?? 0.04,
            mock.notes || 'Créé depuis les tâches initiales'
          ]
        );
        taskRes = await client.query(
          `SELECT * FROM tasks WHERE task_id = $1 OR id::text = $1 FOR UPDATE`,
          [taskId]
        );
      }
    }

    if (taskRes.rows.length === 0) {
      throw new Error(`Tâche ${taskId} introuvable`);
    }

    const task = taskRes.rows[0];
    const actualTaskId = task.task_id;
    const tgUserId = task.telegram_user_id;

    const updatedTaskRes = await client.query(
      `
      UPDATE tasks
      SET
        account_status = 'suspended',
        verification_status = 'rejected',
        verification_method = $1,
        verification_result = 'RED',
        verification_reason = $2,
        status = 'compte suspendu',
        validation_status = 'rejected',
        validation_reason = $2,
        validated_at = NOW(),
        verified_at = NOW(),
        validated_by = $3,
        verified_by = $3,
        reward_paid = FALSE,
        completed_at = NOW()
      WHERE task_id = $4
      RETURNING *
      `,
      [method, reason, validatorId, actualTaskId]
    );

    // Upsert account record as suspended
    if (task.uid) {
      await client.query(
        `
        INSERT INTO accounts (task_id, uid, first_name, last_name, account_status, validated_at)
        VALUES ($1, $2, $3, $4, 'suspended', NOW())
        ON CONFLICT (task_id) DO UPDATE
        SET account_status = 'suspended', validated_at = NOW()
        `,
        [actualTaskId, task.uid, task.first_name, task.last_name]
      );
    }

    // Record validation report
    await client.query(
      `
      INSERT INTO task_validations (task_id, validator_id, status, reason, validated_at)
      VALUES ($1, $2, 'rejected', $3, NOW())
      `,
      [actualTaskId, validatorId, reason]
    );

    // Fetch user balance (unchanged)
    let currentBal = 0;
    if (tgUserId) {
      const wRes = await client.query(
        `SELECT w.balance FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.telegram_user_id = $1`,
        [tgUserId]
      );
      currentBal = Number(wRes.rows[0]?.balance || 0);
    }

    await client.query('COMMIT');

    const updatedTask = mapDbTaskToRecord(updatedTaskRes.rows[0]);

    // Send user notification in their language
    if (tgUserId) {
      sendTelegramVerificationMessage(tgUserId, {
        isAccepted: false,
        isBot: method === 'BOT',
        rewardUSD: 0,
        currentBalance: currentBal,
        reason
      }).catch(err => console.warn('⚠️ Notification error on task rejection:', err));
    }

    // Sync to Google Sheets (row updated with task ID)
    syncTaskToGoogleSheets(updatedTask).catch(() => {});

    // Audit log
    logAudit('reject_task', validatorId, {
      taskId: actualTaskId,
      method,
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
 * Perform automatic verification check for a Facebook account (Bot check)
 * Sends the user's Facebook UID to the Facebook checking service/API.
 * 
 * Result interpretation:
 * - GREEN / valid result → account automatically VERIFIED, reward credited
 * - RED / invalid result → account automatically REJECTED/SUSPENDED, no reward
 */
export async function performBotAccountCheck(
  taskId: string,
  settings?: any
): Promise<TaskRecord> {
  let res = await pool.query(
    `SELECT * FROM tasks WHERE task_id = $1 OR id::text = $1`,
    [taskId]
  );

  if (res.rows.length === 0) {
    const mock = INITIAL_TASKS.find(t => t.id === taskId);
    if (mock) {
      await pool.query(
        `
        INSERT INTO tasks (
          task_id, telegram_user_id, task_type, status, account_status,
          verification_status, verification_method, verification_result,
          uid, first_name, last_name, password, cookies, reward_usd,
          validation_status, validation_reason, reward_paid, created_at
        ) VALUES (
          $1, $2, $3, 'pending', 'pending_verification',
          'pending', 'NONE', 'PENDING',
          $4, $5, $6, $7, $8, $9,
          'pending', $10, FALSE, NOW()
        )
        ON CONFLICT (task_id) DO NOTHING
        `,
        [
          mock.id,
          mock.telegramUserId || '589234102',
          mock.taskType || 'Facebook',
          mock.uid || '',
          mock.firstName || '',
          mock.lastName || '',
          mock.password || '',
          mock.cookies || '',
          mock.rewardUSD ?? 0.04,
          mock.notes || 'Créé depuis les tâches initiales'
        ]
      );
      res = await pool.query(
        `SELECT * FROM tasks WHERE task_id = $1 OR id::text = $1`,
        [taskId]
      );
    }
  }

  if (res.rows.length === 0) {
    throw new Error(`Tâche ${taskId} introuvable`);
  }

  const task = res.rows[0];
  const actualTaskId = task.task_id;

  if (!task.uid || !task.uid.trim()) {
    return await rejectTask(
      actualTaskId,
      'BOT',
      'UID Facebook manquant ou non renseigné',
      'BOT'
    );
  }

  // Check if UID is already used/duplicate in an existing verified task
  try {
    const dupRes = await pool.query(
      `SELECT task_id FROM tasks WHERE uid = $1 AND task_id != $2 AND (account_status = 'verified' OR validation_status = 'validated') LIMIT 1`,
      [task.uid.trim(), actualTaskId]
    );
    if (dupRes.rows.length > 0) {
      return await rejectTask(
        actualTaskId,
        'BOT',
        `Compte déjà enregistré et vérifié (doublon avec la tâche ${dupRes.rows[0].task_id})`,
        'BOT'
      );
    }
  } catch (err: any) {
    console.warn('⚠️ UID duplicate check warning:', err.message);
  }

  // Run the Facebook checker
  const checkResult = await checkFacebookUid(task.uid, settings);

  if (checkResult.status === 'GREEN') {
    return await validateTask(
      actualTaskId,
      'BOT',
      checkResult.reason || 'Vérification automatique Bot réussie (GREEN)',
      'BOT'
    );
  } else {
    return await rejectTask(
      actualTaskId,
      'BOT',
      checkResult.reason || 'Échec de la vérification automatique Facebook (RED)',
      'BOT'
    );
  }
}

/**
 * Update task status (e.g. manual status change)
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
