import { pool } from './database';

export async function initializeDatabase() {
  await pool.query(`
    /* =========================================================
       USERS
       ========================================================= */
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

    /* =========================================================
       WALLETS
       ========================================================= */
    CREATE TABLE IF NOT EXISTS wallets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
      balance NUMERIC(12, 4) NOT NULL DEFAULT 0,
      total_earned NUMERIC(12, 4) NOT NULL DEFAULT 0,
      total_withdrawn NUMERIC(12, 4) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    /* =========================================================
       TASKS
       ========================================================= */
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      task_id TEXT UNIQUE NOT NULL,

      telegram_user_id TEXT,
      task_type TEXT,

      /*
       * Workflow:
       * pending
       * pending_validation
       * validated
       * rejected
       * compte créé
       * compte suspendu
       * annulé
       */
      status TEXT NOT NULL DEFAULT 'pending',

      uid TEXT,
      first_name TEXT,
      last_name TEXT,
      password TEXT,
      cookies TEXT,

      reward_usd NUMERIC(12, 4) DEFAULT 0,

      /*
       * Validation metadata
       */
      validation_status TEXT DEFAULT 'pending',
      validation_reason TEXT,
      validated_at TIMESTAMPTZ,
      validated_by INTEGER,

      /*
       * Account creation metadata
       */
      account_created BOOLEAN NOT NULL DEFAULT FALSE,
      account_created_at TIMESTAMPTZ,

      /*
       * Reward metadata
       */
      reward_paid BOOLEAN NOT NULL DEFAULT FALSE,
      reward_paid_at TIMESTAMPTZ,

      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );

    /* =========================================================
       TRANSACTIONS
       ========================================================= */
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

    /* =========================================================
       WITHDRAWALS
       ========================================================= */
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

    /* =========================================================
       BOT SETTINGS
       ========================================================= */
    CREATE TABLE IF NOT EXISTS bot_settings (
      id INTEGER PRIMARY KEY,
      settings JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    /* =========================================================
       TASK VALIDATIONS
       ========================================================= */
    CREATE TABLE IF NOT EXISTS task_validations (
      id SERIAL PRIMARY KEY,

      task_id TEXT NOT NULL
        REFERENCES tasks(task_id) ON DELETE CASCADE,

      /*
       * ID of the admin/validator.
       * Nullable because some validation can initially
       * be performed automatically.
       */
      validator_id INTEGER,

      /*
       * pending
       * validated
       * rejected
       */
      status TEXT NOT NULL DEFAULT 'pending',

      reason TEXT,

      /*
       * Stores detailed validation information:
       * {
       *   "uidValid": true,
       *   "cookiesValid": true,
       *   "credentialsValid": true
       * }
       */
      validation_data JSONB DEFAULT '{}'::jsonb,

      validated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    /* =========================================================
       ACCOUNTS
       ========================================================= */
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,

      task_id TEXT UNIQUE NOT NULL
        REFERENCES tasks(task_id) ON DELETE CASCADE,

      uid TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,

      /*
       * active
       * suspended
       * disabled
       */
      account_status TEXT NOT NULL DEFAULT 'active',

      /*
       * This field confirms that the account came
       * from a validated task.
       */
      validated_at TIMESTAMPTZ NOT NULL,

      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    /* =========================================================
       VALIDATION REPORTS
       ========================================================= */
    CREATE TABLE IF NOT EXISTS validation_reports (
      id SERIAL PRIMARY KEY,

      task_id TEXT NOT NULL
        REFERENCES tasks(task_id) ON DELETE CASCADE,

      validation_id INTEGER
        REFERENCES task_validations(id) ON DELETE SET NULL,

      /*
       * validated
       * rejected
       */
      result TEXT NOT NULL,

      /*
       * Detailed checks performed during validation.
       */
      checks JSONB DEFAULT '{}'::jsonb,

      notes TEXT,

      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    /* =========================================================
       INDEXES
       ========================================================= */

    CREATE INDEX IF NOT EXISTS idx_tasks_status
      ON tasks(status);

    CREATE INDEX IF NOT EXISTS idx_tasks_validation_status
      ON tasks(validation_status);

    CREATE INDEX IF NOT EXISTS idx_tasks_telegram_user_id
      ON tasks(telegram_user_id);

    CREATE INDEX IF NOT EXISTS idx_task_validations_task_id
      ON task_validations(task_id);

    CREATE INDEX IF NOT EXISTS idx_task_validations_status
      ON task_validations(status);

    CREATE INDEX IF NOT EXISTS idx_validation_reports_task_id
      ON validation_reports(task_id);

    CREATE INDEX IF NOT EXISTS idx_accounts_uid
      ON accounts(uid);
  `);

  /*
   * ============================================================
   * DATABASE MIGRATION
   * ============================================================
   *
   * The CREATE TABLE above only affects new installations.
   * These ALTER TABLE statements ensure that an existing
   * PostgreSQL database also receives the new columns.
   */

  await pool.query(`
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending';

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS validation_reason TEXT;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS validated_by INTEGER;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS account_created BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS account_created_at TIMESTAMPTZ;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS reward_paid BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS reward_paid_at TIMESTAMPTZ;
  `);

  /*
   * Existing tasks should remain usable.
   * Only tasks that have not yet gone through validation
   * are considered pending.
   */
  await pool.query(`
    UPDATE tasks
    SET validation_status = 'pending'
    WHERE validation_status IS NULL;
  `);

  console.log('✅ PostgreSQL tables initialized');
  console.log('✅ Validation workflow tables initialized');
  console.log('✅ Task validation columns verified');
}

