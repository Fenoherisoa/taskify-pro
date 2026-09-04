import { pool } from './database';

export interface PersistentUser {
  id: number;
  telegram_user_id: string;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  language: string;
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
