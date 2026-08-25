import { pool } from './database';

export interface PersistentUser {
  id: number;
  telegram_user_id: string;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface Wallet {
  id: number;
  user_id: number;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
}

/**
 * Créer ou récupérer un utilisateur Telegram
 */
export async function getOrCreateUser(
  telegramUserId: string | number,
  telegramUsername?: string,
  firstName?: string,
  lastName?: string
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
          updated_at = NOW()
        WHERE telegram_user_id = $1
        RETURNING *
        `,
        [
          telegramId,
          telegramUsername || null,
          firstName || null,
          lastName || null
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
          last_name
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [
          telegramId,
          telegramUsername || null,
          firstName || null,
          lastName || null
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