import { pool } from './database';

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_user_id TEXT UNIQUE NOT NULL,
      telegram_username TEXT,
      first_name TEXT,
      last_name TEXT,
      language TEXT DEFAULT 'fr',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
      balance NUMERIC(12, 4) NOT NULL DEFAULT 0,
      total_earned NUMERIC(12, 4) NOT NULL DEFAULT 0,
      total_withdrawn NUMERIC(12, 4) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      task_id TEXT UNIQUE NOT NULL,
      telegram_user_id TEXT,
      task_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      uid TEXT,
      first_name TEXT,
      last_name TEXT,
      password TEXT,
      cookies TEXT,
      reward_usd NUMERIC(12, 4) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT,
      type TEXT NOT NULL,
      amount NUMERIC(12, 4) NOT NULL,
      balance_before NUMERIC(12, 4) NOT NULL,
      balance_after NUMERIC(12, 4) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(12, 4) NOT NULL,
      method TEXT,
      destination TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS bot_settings (
      id INTEGER PRIMARY KEY,
      settings JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // -----------------------------------------------
  // LOAD SAVED BOT SETTINGS
  // -----------------------------------------------

  const settingsResult = await pool.query(
    `SELECT settings FROM bot_settings WHERE id = 1 LIMIT 1`
  );

  if (settingsResult.rows.length > 0) {
    const savedSettings = settingsResult.rows[0].settings;

    if (
      savedSettings &&
      typeof savedSettings === 'object'
    ) {
      Object.assign(botSettings, savedSettings);
    }

    console.log('✅ Bot settings loaded from PostgreSQL');
  } else {
    // Première installation :
    // sauvegarder les settings actuels comme configuration initiale.

    await pool.query(
      `
      INSERT INTO bot_settings (id, settings, updated_at)
      VALUES (1, $1::jsonb, NOW())
      `,
      [JSON.stringify(botSettings)]
    );

    console.log('✅ Initial bot settings saved to PostgreSQL');
  }

  console.log('✅ PostgreSQL tables initialized');
}