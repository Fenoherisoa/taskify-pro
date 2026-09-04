import { pool } from './database';
import { WithdrawalRecord, WithdrawalStatus, TransactionRecord } from '../types';
import { logAudit } from './auditService';
import { createNotification } from './notificationService';

export const MIN_WITHDRAWAL_USD = 1.00; // Accessible threshold for tests & production

/**
 * Request a withdrawal from Telegram bot or Mini App
 */
export async function requestWithdrawal(
  telegramUserId: string | number,
  amount: number,
  method: string,
  destination: string
): Promise<{ success: boolean; message: string; withdrawal?: WithdrawalRecord; newBalance?: number }> {
  const cleanMethod = (method || '').trim();
  const isUsdt = cleanMethod.toLowerCase().includes('usdt');
  const isBinance = cleanMethod.toLowerCase().includes('binance');

  if (!isUsdt && !isBinance) {
    return {
      success: false,
      message: 'Seuls les retraits via USDT ou Binance sont supportés. Les méthodes Mobile Money ne sont pas acceptées.'
    };
  }

  if (isNaN(amount) || amount < MIN_WITHDRAWAL_USD) {
    return {
      success: false,
      message: `Le montant minimum de retrait est de $${MIN_WITHDRAWAL_USD.toFixed(2)} USD.`
    };
  }

  if (!destination || !destination.trim()) {
    return {
      success: false,
      message: `Veuillez fournir une adresse ${isUsdt ? 'USDT (TRC20)' : 'Binance ID'} valide.`
    };
  }

  const tgId = String(telegramUserId);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Get user with lock
    const userRes = await client.query(
      `SELECT id, usdt_address, binance_id FROM users WHERE telegram_user_id = $1 FOR UPDATE`,
      [tgId]
    );

    if (userRes.rows.length === 0) {
      throw new Error('Compte utilisateur introuvable.');
    }

    const userId = userRes.rows[0].id;

    // Update user withdrawal info automatically
    if (isUsdt) {
      await client.query(
        `UPDATE users SET usdt_address = $1, updated_at = NOW() WHERE id = $2`,
        [destination.trim(), userId]
      );
    } else if (isBinance) {
      await client.query(
        `UPDATE users SET binance_id = $1, updated_at = NOW() WHERE id = $2`,
        [destination.trim(), userId]
      );
    }

    // 2. Lock and get wallet row
    const walletRes = await client.query(
      `SELECT balance, pending_withdrawal, total_withdrawn FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    if (walletRes.rows.length === 0) {
      throw new Error('Portefeuille introuvable.');
    }

    const currentBalance = Number(walletRes.rows[0].balance);
    if (currentBalance < amount) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Solde insuffisant ($${currentBalance.toFixed(3)} USD disponible, $${amount.toFixed(2)} USD requis).`
      };
    }

    const newBalance = currentBalance - amount;

    // 3. Deduct from available balance, add to pending_withdrawal (funds safely reserved)
    await client.query(
      `
      UPDATE wallets
      SET
        balance = balance - $1,
        pending_withdrawal = pending_withdrawal + $1,
        updated_at = NOW()
      WHERE user_id = $2
      `,
      [amount, userId]
    );

    // 4. Create withdrawal record
    const withdrawalRes = await client.query(
      `
      INSERT INTO withdrawals (
        user_id,
        amount,
        method,
        destination,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
      RETURNING *
      `,
      [userId, amount, method, destination]
    );

    const withdrawalId = withdrawalRes.rows[0].id;

    // 5. Create ledger transaction record
    await client.query(
      `
      INSERT INTO transactions (
        user_id,
        task_id,
        type,
        amount,
        balance_before,
        balance_after,
        description,
        created_at
      )
      VALUES ($1, $2, 'withdrawal_request', $3, $4, $5, $6, NOW())
      `,
      [
        userId,
        `w-${withdrawalId}`,
        -amount,
        currentBalance,
        newBalance,
        `Demande de retrait #${withdrawalId} via ${method} vers ${destination}`
      ]
    );

    await client.query('COMMIT');

    // Create user notification
    createNotification(
      userId,
      'Demande de retrait enregistrée',
      `Votre demande de retrait de $${amount.toFixed(2)} USD via ${method} a été soumise avec succès et est en attente de validation.`,
      'withdrawal'
    ).catch(() => {});

    const createdRecord: WithdrawalRecord = {
      id: withdrawalId,
      userId,
      telegramUserId: tgId,
      amount,
      method,
      destination,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    logAudit('request_withdrawal', tgId, {
      withdrawalId,
      amount,
      method,
      destination
    }).catch(() => {});

    return {
      success: true,
      message: `Demande de retrait de $${amount.toFixed(2)} USD enregistrée avec succès.`,
      withdrawal: createdRecord,
      newBalance
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Withdrawal request error:', err);
    return {
      success: false,
      message: err.message || 'Erreur lors de la demande de retrait.'
    };
  } finally {
    client.release();
  }
}

/**
 * Get all withdrawals (for Admin Dashboard)
 */
export async function getAllWithdrawals(statusFilter?: string): Promise<WithdrawalRecord[]> {
  try {
    let query = `
      SELECT
        w.id,
        w.user_id,
        w.amount,
        w.method,
        w.destination,
        w.status,
        w.admin_id,
        w.admin_notes,
        w.created_at,
        w.processed_at,
        u.telegram_user_id,
        u.telegram_username,
        u.first_name,
        u.last_name
      FROM withdrawals w
      LEFT JOIN users u ON u.id = w.user_id
    `;
    const params: any[] = [];

    if (statusFilter && statusFilter !== 'all') {
      query += ` WHERE w.status = $1`;
      params.push(statusFilter);
    }

    query += ` ORDER BY w.id DESC LIMIT 300`;

    const result = await pool.query(query, params);

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      telegramUserId: row.telegram_user_id,
      telegramUsername: row.telegram_username || 'anonyme',
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      amount: Number(row.amount),
      method: row.method || 'Inconnu',
      destination: row.destination || '',
      status: row.status as WithdrawalStatus,
      adminId: row.admin_id,
      adminNotes: row.admin_notes,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      processedAt: row.processed_at ? new Date(row.processed_at).toISOString() : null
    }));
  } catch (err: any) {
    console.error('❌ Failed to fetch withdrawals:', err.message);
    return [];
  }
}

/**
 * Get withdrawals for a specific user (for Telegram Bot & Mini App)
 */
export async function getUserWithdrawals(telegramUserId: string | number): Promise<WithdrawalRecord[]> {
  try {
    const res = await pool.query(
      `
      SELECT
        w.id,
        w.user_id,
        w.amount,
        w.method,
        w.destination,
        w.status,
        w.admin_id,
        w.admin_notes,
        w.created_at,
        w.processed_at
      FROM withdrawals w
      INNER JOIN users u ON u.id = w.user_id
      WHERE u.telegram_user_id = $1
      ORDER BY w.id DESC
      LIMIT 100
      `,
      [String(telegramUserId)]
    );

    return res.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      telegramUserId: String(telegramUserId),
      amount: Number(row.amount),
      method: row.method,
      destination: row.destination,
      status: row.status as WithdrawalStatus,
      adminId: row.admin_id,
      adminNotes: row.admin_notes,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      processedAt: row.processed_at ? new Date(row.processed_at).toISOString() : null
    }));
  } catch (err: any) {
    console.error('❌ Failed to fetch user withdrawals:', err.message);
    return [];
  }
}

/**
 * Get transactions ledger for a user
 */
export async function getUserTransactions(telegramUserId: string | number): Promise<TransactionRecord[]> {
  try {
    const res = await pool.query(
      `
      SELECT t.*, u.telegram_user_id, u.telegram_username
      FROM transactions t
      INNER JOIN users u ON u.id = t.user_id
      WHERE u.telegram_user_id = $1
      ORDER BY t.id DESC
      LIMIT 100
      `,
      [String(telegramUserId)]
    );

    return res.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      telegramUserId: row.telegram_user_id,
      telegramUsername: row.telegram_username,
      taskId: row.task_id,
      type: row.type,
      amount: Number(row.amount),
      balanceBefore: Number(row.balance_before),
      balanceAfter: Number(row.balance_after),
      description: row.description || '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    }));
  } catch (err: any) {
    console.error('❌ Failed to fetch user transactions:', err.message);
    return [];
  }
}

/**
 * Get all ledger transactions (Admin view)
 */
export async function getAllTransactions(): Promise<TransactionRecord[]> {
  try {
    const res = await pool.query(
      `
      SELECT t.*, u.telegram_user_id, u.telegram_username
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      ORDER BY t.id DESC
      LIMIT 300
      `
    );

    return res.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      telegramUserId: row.telegram_user_id,
      telegramUsername: row.telegram_username,
      taskId: row.task_id,
      type: row.type,
      amount: Number(row.amount),
      balanceBefore: Number(row.balance_before),
      balanceAfter: Number(row.balance_after),
      description: row.description || '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    }));
  } catch (err: any) {
    console.error('❌ Failed to fetch all transactions:', err.message);
    return [];
  }
}

/**
 * Process a withdrawal with full lifecycle support:
 * Statuses: 'approved', 'processing', 'paid', 'rejected', 'cancelled'
 */
export async function processWithdrawal(
  withdrawalId: number,
  action: WithdrawalStatus,
  adminId: string = 'admin',
  notes?: string
): Promise<{ success: boolean; message: string }> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch withdrawal with lock
    const wRes = await client.query(
      `SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE`,
      [withdrawalId]
    );

    if (wRes.rows.length === 0) {
      throw new Error('Retrait introuvable.');
    }

    const withdrawal = wRes.rows[0];
    const previousStatus = withdrawal.status;

    if (['paid', 'rejected', 'cancelled'].includes(previousStatus)) {
      throw new Error(`Ce retrait est déjà finalisé (statut actuel: ${previousStatus}).`);
    }

    const userId = withdrawal.user_id;
    const amount = Number(withdrawal.amount);

    if (action === 'approved') {
      await client.query(
        `
        UPDATE withdrawals
        SET
          status = 'approved',
          admin_id = $1,
          admin_notes = $2,
          updated_at = NOW()
        WHERE id = $3
        `,
        [adminId, notes || null, withdrawalId]
      );

      createNotification(
        userId,
        'Retrait approuvé',
        `Votre retrait #${withdrawalId} de $${amount.toFixed(2)} USD a été approuvé et est prêt pour le paiement.`,
        'withdrawal'
      ).catch(() => {});

    } else if (action === 'processing') {
      await client.query(
        `
        UPDATE withdrawals
        SET
          status = 'processing',
          admin_id = $1,
          admin_notes = $2,
          updated_at = NOW()
        WHERE id = $3
        `,
        [adminId, notes || null, withdrawalId]
      );

      createNotification(
        userId,
        'Retrait en cours de traitement',
        `Votre retrait #${withdrawalId} de $${amount.toFixed(2)} USD est en cours d'exécution vers votre compte ${withdrawal.method}.`,
        'withdrawal'
      ).catch(() => {});

    } else if (action === 'paid') {
      // 1. Update wallet: release from pending_withdrawal, increase total_withdrawn
      await client.query(
        `
        UPDATE wallets
        SET
          pending_withdrawal = GREATEST(0, pending_withdrawal - $1),
          total_withdrawn = total_withdrawn + $1,
          updated_at = NOW()
        WHERE user_id = $2
        `,
        [amount, userId]
      );

      // 2. Mark withdrawal as paid
      await client.query(
        `
        UPDATE withdrawals
        SET
          status = 'paid',
          processed_at = NOW(),
          admin_id = $1,
          admin_notes = $2,
          updated_at = NOW()
        WHERE id = $3
        `,
        [adminId, notes || null, withdrawalId]
      );

      // 3. Current wallet balance for ledger
      const walletRes = await client.query(`SELECT balance FROM wallets WHERE user_id = $1`, [userId]);
      const currentBal = Number(walletRes.rows[0]?.balance || 0);

      // 4. Record ledger transaction
      await client.query(
        `
        INSERT INTO transactions (
          user_id,
          task_id,
          type,
          amount,
          balance_before,
          balance_after,
          description,
          created_at
        )
        VALUES ($1, $2, 'withdrawal_paid', 0, $3, $3, $4, NOW())
        `,
        [
          userId,
          `paid-w-${withdrawalId}`,
          currentBal,
          `Paiement effectué pour le retrait #${withdrawalId} ($${amount.toFixed(2)} USD) via ${withdrawal.method} vers ${withdrawal.destination}`
        ]
      );

      createNotification(
        userId,
        'Retrait payé avec succès !',
        `Votre retrait #${withdrawalId} de $${amount.toFixed(2)} USD a été envoyé avec succès vers ${withdrawal.destination}.`,
        'withdrawal'
      ).catch(() => {});

    } else if (action === 'rejected' || action === 'cancelled') {
      // Refund reserved funds back to user's available balance!
      const walletRes = await client.query(
        `SELECT balance, pending_withdrawal FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      const balBefore = Number(walletRes.rows[0]?.balance || 0);
      const balAfter = balBefore + amount;

      await client.query(
        `
        UPDATE wallets
        SET
          balance = balance + $1,
          pending_withdrawal = GREATEST(0, pending_withdrawal - $1),
          updated_at = NOW()
        WHERE user_id = $2
        `,
        [amount, userId]
      );

      await client.query(
        `
        UPDATE withdrawals
        SET
          status = $1,
          processed_at = NOW(),
          admin_id = $2,
          admin_notes = $3,
          updated_at = NOW()
        WHERE id = $4
        `,
        [action, adminId, notes || null, withdrawalId]
      );

      // Record reversal transaction in ledger
      await client.query(
        `
        INSERT INTO transactions (
          user_id,
          task_id,
          type,
          amount,
          balance_before,
          balance_after,
          description,
          created_at
        )
        VALUES ($1, $2, 'withdrawal_refund', $3, $4, $5, $6, NOW())
        `,
        [
          userId,
          `refund-w-${withdrawalId}`,
          amount,
          balBefore,
          balAfter,
          `Remboursement suite à ${action === 'rejected' ? 'un rejet' : 'une annulation'} du retrait #${withdrawalId}${notes ? ` (Motif : ${notes})` : ''}`
        ]
      );

      createNotification(
        userId,
        `Retrait ${action === 'rejected' ? 'rejeté' : 'annulé'}`,
        `Votre demande #${withdrawalId} a été ${action === 'rejected' ? 'rejetée' : 'annulée'}. Les fonds ($${amount.toFixed(2)} USD) ont été restitués sur votre solde disponible.${notes ? ` Motif : ${notes}` : ''}`,
        'withdrawal'
      ).catch(() => {});
    }

    await client.query('COMMIT');

    logAudit(`withdrawal_${action}`, adminId, {
      withdrawalId,
      amount,
      action,
      notes
    }).catch(() => {});

    return {
      success: true,
      message: `Retrait #${withdrawalId} marqué comme '${action}'.`
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error processing withdrawal:', err);
    return {
      success: false,
      message: err.message || 'Erreur lors du traitement du retrait.'
    };
  } finally {
    client.release();
  }
}
