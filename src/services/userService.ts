import { pool } from './database';

export interface PersistentUser {
  id: number;
  telegram_user_id: string;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  language: string;
  usdt_address?: string | null;
  binance_id?: string | null;
}

export interface Wallet {
  id: number;
  user_id: number;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
}

export interface UserStats {
  completed: number;
  pending: number;
  rejected: number;
}

/**
 * Créer ou récupérer un utilisateur Telegram
 */
export async function getOrCreateUser(
  telegramUserId: string | number,
  telegramUsername?: string,
  firstName?: string,
  lastName?: string,
  language?: string
): Promise<PersistentUser> {
  const telegramId = String(telegramUserId);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingUser = await client.query(
      `
      SELECT *
      FROM users
      WHERE telegram_user_id = $1
      `,
      [telegramId]
    );

    let user: PersistentUser;

    if (existingUser.rows.length > 0) {
      const updated = await client.query(
        `
        UPDATE users
        SET
          telegram_username = COALESCE($2, telegram_username),
          first_name = COALESCE($3, first_name),
          last_name = COALESCE($4, last_name),
          language = COALESCE($5, language),
          updated_at = NOW()
        WHERE telegram_user_id = $1
        RETURNING *
        `,
        [
          telegramId,
          telegramUsername || null,
          firstName || null,
          lastName || null,
          language || null
        ]
      );

      user = updated.rows[0];

    } else {
      const created = await client.query(
        `
        INSERT INTO users (
          telegram_user_id,
          telegram_username,
          first_name,
          last_name,
          language
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          telegramId,
          telegramUsername || null,
          firstName || null,
          lastName || null,
          language || 'fr'
        ]
      );

      user = created.rows[0];
    }

    // Créer automatiquement le wallet s'il n'existe pas
    await client.query(
      `
      INSERT INTO wallets (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
      `,
      [user.id]
    );

    await client.query('COMMIT');

    return user;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}

/**
 * Mettre à jour la langue de l'utilisateur
 */
export async function setUserLanguage(
  telegramUserId: string | number,
  language: string
): Promise<boolean> {
  try {
    await pool.query(
      `
      UPDATE users
      SET language = $1, updated_at = NOW()
      WHERE telegram_user_id = $2
      `,
      [language, String(telegramUserId)]
    );
    return true;
  } catch (err: any) {
    console.error('❌ Failed to update user language:', err.message);
    return false;
  }
}

/**
 * Récupérer les statistiques des tâches d'un utilisateur
 */
export async function getUserStats(
  telegramUserId: string | number
): Promise<UserStats> {
  try {
    const res = await pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE validation_status = 'validated' OR status = 'compte créé' OR status = 'vérifié')::INTEGER AS completed,
        COUNT(*) FILTER (WHERE validation_status = 'pending' OR status = 'en attente' OR status = 'pending')::INTEGER AS pending,
        COUNT(*) FILTER (WHERE validation_status = 'rejected' OR status = 'annulé')::INTEGER AS rejected
      FROM tasks
      WHERE telegram_user_id = $1
      `,
      [String(telegramUserId)]
    );

    const row = res.rows[0] || {};
    return {
      completed: Number(row.completed || 0),
      pending: Number(row.pending || 0),
      rejected: Number(row.rejected || 0)
    };
  } catch (err: any) {
    console.error('❌ Failed to fetch user stats:', err.message);
    return { completed: 0, pending: 0, rejected: 0 };
  }
}

/**
 * Récupérer le wallet d'un utilisateur Telegram
 */
export async function getUserWallet(
  telegramUserId: string | number
): Promise<Wallet | null> {
  const result = await pool.query(
    `
    SELECT
      w.*
    FROM wallets w
    INNER JOIN users u
      ON u.id = w.user_id
    WHERE u.telegram_user_id = $1
    `,
    [String(telegramUserId)]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    ...result.rows[0],
    balance: Number(result.rows[0].balance),
    total_earned: Number(result.rows[0].total_earned),
    total_withdrawn: Number(result.rows[0].total_withdrawn)
  };
}

/**
 * Profil complet de l'utilisateur (user + wallet + stats)
 */
export async function getUserProfile(telegramUserId: string | number) {
  const user = await getOrCreateUser(telegramUserId);
  const wallet = await getUserWallet(telegramUserId);
  const statistics = await getUserStats(telegramUserId);

  return {
    user,
    wallet: wallet || {
      balance: 0,
      totalEarned: 0,
      totalWithdrawn: 0
    },
    statistics
  };
}

/**
 * Récupérer les adresses de retrait enregistrées (USDT / Binance)
 */
export async function getUserWithdrawalInfo(
  telegramUserId: string | number
): Promise<{ usdtAddress: string; binanceId: string }> {
  try {
    const res = await pool.query(
      `SELECT usdt_address, binance_id FROM users WHERE telegram_user_id = $1`,
      [String(telegramUserId)]
    );
    if (res.rows.length === 0) return { usdtAddress: '', binanceId: '' };
    return {
      usdtAddress: res.rows[0].usdt_address || '',
      binanceId: res.rows[0].binance_id || ''
    };
  } catch (err) {
    return { usdtAddress: '', binanceId: '' };
  }
}

/**
 * Enregistrer ou mettre à jour les adresses de retrait (USDT / Binance)
 */
export async function updateUserWithdrawalInfo(
  telegramUserId: string | number,
  data: { usdtAddress?: string; binanceId?: string }
): Promise<{ success: boolean; usdtAddress: string; binanceId: string }> {
  const tgId = String(telegramUserId);
  await getOrCreateUser(tgId);
  const current = await getUserWithdrawalInfo(tgId);
  const newUsdt = data.usdtAddress !== undefined ? data.usdtAddress.trim() : current.usdtAddress;
  const newBinance = data.binanceId !== undefined ? data.binanceId.trim() : current.binanceId;

  await pool.query(
    `UPDATE users SET usdt_address = $1, binance_id = $2, updated_at = NOW() WHERE telegram_user_id = $3`,
    [newUsdt, newBinance, tgId]
  );

  return { success: true, usdtAddress: newUsdt, binanceId: newBinance };
}

/**
 * Récupérer tous les portefeuilles pour l'administration
 */
export async function getAllWallets(): Promise<any[]> {
  try {
    const result = await pool.query(`
      SELECT
        w.id,
        w.user_id,
        w.balance,
        w.pending_withdrawal,
        w.total_earned,
        w.total_withdrawn,
        w.updated_at,
        u.telegram_user_id,
        u.telegram_username,
        u.first_name,
        u.last_name,
        u.language
      FROM wallets w
      LEFT JOIN users u ON u.id = w.user_id
      ORDER BY w.id DESC
    `);
    return result.rows.map((row: any) => ({
      ...row,
      balance: Number(row.balance),
      pending_withdrawal: Number(row.pending_withdrawal || 0),
      total_earned: Number(row.total_earned),
      total_withdrawn: Number(row.total_withdrawn)
    }));
  } catch (err: any) {
    console.error('❌ Failed to fetch all wallets:', err.message);
    return [];
  }
}

/**
 * Enregistrer ou mettre à jour les informations de retrait d'un utilisateur (USDT et/ou Binance ID)
 */
export async function saveUserWithdrawalInfo(
  telegramUserId: string | number,
  info: { usdtAddress?: string | null; binanceId?: string | null }
): Promise<PersistentUser> {
  const user = await getOrCreateUser(telegramUserId);
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (info.usdtAddress !== undefined) {
    updates.push(`usdt_address = $${paramIndex++}`);
    values.push(info.usdtAddress?.trim() || null);
  }

  if (info.binanceId !== undefined) {
    updates.push(`binance_id = $${paramIndex++}`);
    values.push(info.binanceId?.trim() || null);
  }

  if (updates.length > 0) {
    values.push(user.id);
    const sql = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;
    const res = await pool.query(sql, values);
    return res.rows[0];
  }

  return user;
}

/**
 * Supprimer les coordonnées de retrait d'un utilisateur (USDT et Binance ID)
 */
export async function deleteUserWithdrawalInfo(
  telegramUserId: string | number
): Promise<{ success: boolean }> {
  const tgId = String(telegramUserId);
  await pool.query(
    `UPDATE users SET usdt_address = NULL, binance_id = NULL, updated_at = NOW() WHERE telegram_user_id = $1`,
    [tgId]
  );
  return { success: true };
}

/**
 * Récupérer tous les comptes utilisateurs avec leurs statistiques et soldes pour l'Admin
 */
export async function getAllUserAccounts(): Promise<any[]> {
  try {
    const res = await pool.query(`
      SELECT
        u.id,
        u.telegram_user_id,
        u.telegram_username,
        u.first_name,
        u.last_name,
        u.language,
        u.usdt_address,
        u.binance_id,
        u.created_at,
        u.updated_at,
        COALESCE(w.balance, 0) as balance,
        COALESCE(w.pending_withdrawal, 0) as pending_withdrawal,
        COALESCE(w.total_earned, 0) as total_earned,
        COALESCE(w.total_withdrawn, 0) as total_withdrawn,
        (SELECT COUNT(*)::integer FROM tasks t WHERE t.telegram_user_id = u.telegram_user_id AND (t.status = 'compte créé' OR t.status = 'vérifié' OR t.validation_status = 'validated' OR t.account_status = 'verified')) as tasks_completed,
        (SELECT COUNT(*)::integer FROM tasks t WHERE t.telegram_user_id = u.telegram_user_id AND (t.status = 'pending' OR t.status = 'en attente' OR t.validation_status = 'pending')) as tasks_pending,
        (SELECT COUNT(*)::integer FROM tasks t WHERE t.telegram_user_id = u.telegram_user_id AND (t.status = 'compte suspendu' OR t.status = 'annulé' OR t.validation_status = 'rejected' OR t.account_status = 'suspended')) as tasks_rejected
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      ORDER BY u.id DESC
    `);

    return res.rows.map((row: any) => ({
      id: row.id,
      telegramUserId: row.telegram_user_id,
      telegramUsername: row.telegram_username || null,
      firstName: row.first_name || null,
      lastName: row.last_name || null,
      language: row.language || 'fr',
      usdtAddress: row.usdt_address || null,
      binanceId: row.binance_id || null,
      balance: Number(row.balance),
      pendingWithdrawal: Number(row.pending_withdrawal),
      totalEarned: Number(row.total_earned),
      totalWithdrawn: Number(row.total_withdrawn),
      tasksCompleted: Number(row.tasks_completed || 0),
      tasksPending: Number(row.tasks_pending || 0),
      tasksRejected: Number(row.tasks_rejected || 0),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    }));
  } catch (err: any) {
    console.error('❌ Failed to fetch user accounts:', err.message);
    return [];
  }
}

