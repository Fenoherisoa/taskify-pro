import { pool } from './database';

/**
 * ============================================================
 * TASKIFY PRO - DATABASE INITIALIZATION
 * ============================================================
 *
 * PostgreSQL database initialization + safe migrations.
 *
 * IMPORTANT:
 * - Existing data is NOT deleted.
 * - Existing tables are NOT dropped.
 * - New columns are added with IF NOT EXISTS.
 * - Migrations run BEFORE indexes.
 * - Validation workflow:
 *
 *      PENDING
 *         ↓
 *      ADMIN VALIDATION
 *       ↙          ↘
 *  VALIDATED      REJECTED
 *      ↓
 *   REWARD
 *
 * ============================================================
 */

export async function initializeDatabase() {
  console.log('🗄️ Initializing PostgreSQL database...');

  try {
    // ========================================================
    // 1. USERS
    // ========================================================

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
    `);

    // ========================================================
    // 2. WALLETS
    // ========================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,

        user_id INTEGER UNIQUE NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        balance NUMERIC(12, 4) NOT NULL DEFAULT 0,

        total_earned NUMERIC(12, 4) NOT NULL DEFAULT 0,

        total_withdrawn NUMERIC(12, 4) NOT NULL DEFAULT 0,

        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================================
    // 3. TASKS
    // ========================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,

        task_id TEXT UNIQUE NOT NULL,

        telegram_user_id TEXT,

        task_type TEXT,

        /*
         * Main workflow:
         *
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

        validated_by TEXT,

        /*
         * Account metadata
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
    `);

    // ========================================================
    // 4. TRANSACTIONS
    // ========================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,

        user_id INTEGER NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        task_id TEXT,

        type TEXT NOT NULL,

        amount NUMERIC(12, 4) NOT NULL,

        balance_before NUMERIC(12, 4) NOT NULL,

        balance_after NUMERIC(12, 4) NOT NULL,

        description TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================================
    // 5. WITHDRAWALS
    // ========================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,

        user_id INTEGER NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        amount NUMERIC(12, 4) NOT NULL,

        method TEXT,

        destination TEXT,

        status TEXT NOT NULL DEFAULT 'pending',

        created_at TIMESTAMPTZ DEFAULT NOW(),

        processed_at TIMESTAMPTZ
      );
    `);

    // ========================================================
    // 6. BOT SETTINGS
    // ========================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_settings (
        id INTEGER PRIMARY KEY,

        settings JSONB NOT NULL,

        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================================
    // 7. TASK VALIDATIONS
    // ========================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS task_validations (
        id SERIAL PRIMARY KEY,

        task_id TEXT NOT NULL
          REFERENCES tasks(task_id)
          ON DELETE CASCADE,

        /*
         * Telegram ID of the validator/admin.
         */
        validator_id TEXT,

        /*
         * pending
         * validated
         * rejected
         */
        status TEXT NOT NULL DEFAULT 'pending',

        reason TEXT,

        validation_data JSONB DEFAULT '{}'::jsonb,

        validated_at TIMESTAMPTZ,

        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================================
    // 8. ACCOUNTS
    // ========================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,

        task_id TEXT UNIQUE NOT NULL
          REFERENCES tasks(task_id)
          ON DELETE CASCADE,

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
         * Confirms that the account came
         * from a validated task.
         */
        validated_at TIMESTAMPTZ NOT NULL,

        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================================
    // 9. VALIDATION REPORTS
    // ========================================================

    await pool.query(`
      CREATE TABLE IF NOT EXISTS validation_reports (
        id SERIAL PRIMARY KEY,

        task_id TEXT NOT NULL
          REFERENCES tasks(task_id)
          ON DELETE CASCADE,

        validation_id INTEGER
          REFERENCES task_validations(id)
          ON DELETE SET NULL,

        /*
         * validated
         * rejected
         */
        result TEXT NOT NULL,

        /*
         * Detailed validation checks.
         */
        checks JSONB DEFAULT '{}'::jsonb,

        notes TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ========================================================
    // 10. MIGRATIONS - USERS
    // ========================================================

    /*
     * These migrations are safe for an existing database.
     */

    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS telegram_username TEXT;

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS first_name TEXT;

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS last_name TEXT;

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // ========================================================
    // 11. MIGRATIONS - WALLETS
    // ========================================================

    await pool.query(`
      ALTER TABLE wallets
        ADD COLUMN IF NOT EXISTS balance NUMERIC(12, 4)
        NOT NULL DEFAULT 0;

      ALTER TABLE wallets
        ADD COLUMN IF NOT EXISTS total_earned NUMERIC(12, 4)
        NOT NULL DEFAULT 0;

      ALTER TABLE wallets
        ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(12, 4)
        NOT NULL DEFAULT 0;

      ALTER TABLE wallets
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
        DEFAULT NOW();
    `);

    // ========================================================
    // 12. MIGRATIONS - TASKS
    // ========================================================

    /*
     * IMPORTANT:
     *
     * This block MUST run BEFORE creating indexes
     * that reference validation_status.
     */

    await pool.query(`
      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS task_type TEXT;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS uid TEXT;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS first_name TEXT;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS last_name TEXT;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS password TEXT;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS cookies TEXT;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS reward_usd NUMERIC(12, 4)
        DEFAULT 0;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS validation_status TEXT
        DEFAULT 'pending';

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS validation_reason TEXT;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS validated_by TEXT;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS account_created BOOLEAN
        NOT NULL DEFAULT FALSE;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS account_created_at TIMESTAMPTZ;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS reward_paid BOOLEAN
        NOT NULL DEFAULT FALSE;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS reward_paid_at TIMESTAMPTZ;

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
        DEFAULT NOW();

      ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    `);

    // ========================================================
    // 13. MIGRATIONS - TASK VALIDATIONS
    // ========================================================

    await pool.query(`
      ALTER TABLE task_validations
        ADD COLUMN IF NOT EXISTS validator_id TEXT;

      ALTER TABLE task_validations
        ADD COLUMN IF NOT EXISTS status TEXT
        NOT NULL DEFAULT 'pending';

      ALTER TABLE task_validations
        ADD COLUMN IF NOT EXISTS reason TEXT;

      ALTER TABLE task_validations
        ADD COLUMN IF NOT EXISTS validation_data JSONB
        DEFAULT '{}'::jsonb;

      ALTER TABLE task_validations
        ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

      ALTER TABLE task_validations
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
        DEFAULT NOW();
    `);

    // ========================================================
    // 14. MIGRATIONS - VALIDATION REPORTS
    // ========================================================

    await pool.query(`
      ALTER TABLE validation_reports
        ADD COLUMN IF NOT EXISTS validation_id INTEGER;

      ALTER TABLE validation_reports
        ADD COLUMN IF NOT EXISTS result TEXT;

      ALTER TABLE validation_reports
        ADD COLUMN IF NOT EXISTS checks JSONB
        DEFAULT '{}'::jsonb;

      ALTER TABLE validation_reports
        ADD COLUMN IF NOT EXISTS notes TEXT;

      ALTER TABLE validation_reports
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
        DEFAULT NOW();
    `);

    // ========================================================
    // 15. NORMALIZE EXISTING TASKS
    // ========================================================

    /*
     * Existing tasks without validation status become PENDING.
     *
     * IMPORTANT:
     * We do NOT automatically validate existing tasks.
     */

    await pool.query(`
      UPDATE tasks

      SET validation_status = 'pending'

      WHERE validation_status IS NULL
         OR TRIM(validation_status) = '';
    `);

    // ========================================================
    // 16. NORMALIZE EXISTING TASK STATUS
    // ========================================================

    await pool.query(`
      UPDATE tasks

      SET status = 'pending'

      WHERE status IS NULL
         OR TRIM(status) = '';
    `);

    // ========================================================
    // 17. CREATE INDEXES
    // ========================================================
    //
    // IMPORTANT:
    // At this point all columns already exist.
    //
    // ========================================================

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
        idx_tasks_status
      ON tasks(status);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
        idx_tasks_validation_status
      ON tasks(validation_status);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
        idx_tasks_telegram_user_id
      ON tasks(telegram_user_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
        idx_task_validations_task_id
      ON task_validations(task_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
        idx_task_validations_status
      ON task_validations(status);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
        idx_validation_reports_task_id
      ON validation_reports(task_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
        idx_accounts_uid
      ON accounts(uid);
    `);

    // ========================================================
    // 18. VALIDATION CONSTRAINTS / SAFETY
    // ========================================================

    /*
     * Make sure reward_paid never becomes NULL.
     */

    await pool.query(`
      UPDATE tasks

      SET reward_paid = FALSE

      WHERE reward_paid IS NULL;
    `);

    /*
     * Make sure account_created never becomes NULL.
     */

    await pool.query(`
      UPDATE tasks

      SET account_created = FALSE

      WHERE account_created IS NULL;
    `);

    // ========================================================
    // 19. DATABASE CHECK
    // ========================================================

    const result =
      await pool.query(`
        SELECT
          COUNT(*)::INTEGER AS total_tasks,

          COUNT(*) FILTER (
            WHERE validation_status = 'pending'
          )::INTEGER AS pending_tasks,

          COUNT(*) FILTER (
            WHERE validation_status = 'validated'
          )::INTEGER AS validated_tasks,

          COUNT(*) FILTER (
            WHERE validation_status = 'rejected'
          )::INTEGER AS rejected_tasks

        FROM tasks;
      `);

    const statistics =
      result.rows[0];

    // ========================================================
    // 20. SUCCESS
    // ========================================================

    console.log(
      '✅ PostgreSQL tables initialized'
    );

    console.log(
      '✅ Database migrations completed'
    );

    console.log(
      '✅ Validation columns verified'
    );

    console.log(
      '✅ Database indexes verified'
    );

    console.log(
      '📊 Tasks:',
      statistics.total_tasks
    );

    console.log(
      '⏳ Pending:',
      statistics.pending_tasks
    );

    console.log(
      '✅ Validated:',
      statistics.validated_tasks
    );

    console.log(
      '❌ Rejected:',
      statistics.rejected_tasks
    );

  } catch (error) {

    console.error(
      '❌ PostgreSQL initialization failed:',
      error
    );

    throw error;
  }
}
