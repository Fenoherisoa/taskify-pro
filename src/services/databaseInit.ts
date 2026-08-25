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
  `);

  console.log('✅ PostgreSQL tables initialized');
}