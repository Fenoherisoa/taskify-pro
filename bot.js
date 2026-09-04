/**
 * ============================================================
 * TASKIFY PRO - TELEGRAM BOT
 * ============================================================
 *
 * Persistent architecture:
 *
 * Telegram Bot
 *      |
 *      v
 * PostgreSQL  <---- PRIMARY DATABASE
 *      |
 *      +---- Google Sheets Sync
 *
 * Workflow:
 *
 * SUBMISSION
 *     ↓
 * PENDING
 *     ↓
 * ADMIN VALIDATION
 *     ├── VALIDATED → reward credited
 *     └── REJECTED  → no reward
 *
 * IMPORTANT:
 * - PostgreSQL is the persistent source of truth.
 * - Google Sheets remains enabled as synchronization.
 * - No balance is credited before admin validation.
 * - Pending tasks survive Render redeploy.
 * - Validated tasks survive Render redeploy.
 * - Rejected tasks survive Render redeploy.
 *
 * Required ENV:
 *
 * TELEGRAM_BOT_TOKEN=
 * DATABASE_URL=
 * GOOGLE_SHEET_WEBHOOK_URL=
 * ADMIN_TELEGRAM_IDS=123456789,987654321
 * DEFAULT_BOT_PASSWORD=
 * PLATFORM_NAME=Taskify Pro
 * PORT=3000
 *
 * ============================================================
 */

require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');
const http = require('http');

// ============================================================
// 1. CONFIGURATION
// ============================================================

const WORKER_WEB_APP_URL =
  'https://taskify-pro-bf2q.onrender.com';

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN;

const DATABASE_URL =
  process.env.DATABASE_URL || '';

const GOOGLE_SHEET_WEBHOOK_URL =
  process.env.GOOGLE_SHEET_WEBHOOK_URL || '';

const DEFAULT_BOT_PASSWORD =
  process.env.DEFAULT_BOT_PASSWORD ||
  process.env.CUSTOM_PASSWORD ||
  'TaskPassword@2025!';

const PLATFORM_NAME =
  process.env.PLATFORM_NAME ||
  'Taskify Pro';

const PORT =
  process.env.PORT || 3000;

const TASK_REWARD_EUR = 1.50;

const REFERRAL_COMMISSION_EUR = 0.25;

const MIN_WITHDRAWAL_EUR = 10.00;

// ============================================================
// ADMIN IDS
// ============================================================

const ADMIN_TELEGRAM_IDS =
  String(process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

function isAdmin(userId) {
  return ADMIN_TELEGRAM_IDS.includes(
    String(userId)
  );
}

// ============================================================
// TOKEN / DATABASE CHECK
// ============================================================

if (!TELEGRAM_BOT_TOKEN) {
  console.error(
    '❌ TELEGRAM_BOT_TOKEN manquant.'
  );

  process.exit(1);
}

if (!DATABASE_URL) {
  console.error(
    '❌ DATABASE_URL manquant.'
  );

  process.exit(1);
}

// ============================================================
// POSTGRESQL
// ============================================================

const pool = new Pool({
  connectionString: DATABASE_URL,

  ssl: DATABASE_URL
    ? { rejectUnauthorized: false }
    : undefined
});

pool.on('error', error => {
  console.error(
    '❌ PostgreSQL pool error:',
    error.message
  );
});

async function dbQuery(text, params = []) {
  const result = await pool.query(
    text,
    params
  );

  return result;
}

// ============================================================
// TELEGRAM BOT
// ============================================================

const bot =
  new Telegraf(
    TELEGRAM_BOT_TOKEN
  );

// ============================================================
// 2. KEYBOARDS
// ============================================================

const WORKER_MAIN_KEYBOARD =
  Markup.keyboard([
    [
      Markup.button.webApp(
        '🚀 Open Dashboard',
        WORKER_WEB_APP_URL
      )
    ],

    [
      '💰 Solde',
      '📋 Tâches'
    ],

    [
      '🏦 Retrait',
      '📞 Support'
    ],

    [
      '👥 Parrainages',
      '🏆 Classement'
    ],

    [
      '🪩 Langue'
    ]
  ]).resize();

const MAIN_REPLY_KEYBOARD =
  Markup.keyboard([
    [
      '💰 Solde',
      '📋 Tâches'
    ],

    [
      '🏦 Retrait',
      '📞 Support'
    ],

    [
      '👥 Parrainages',
      '🏆 Classement'
    ],

    [
      '🪩 Langue'
    ]
  ]).resize();

// ============================================================
// 3. DATA
// ============================================================

const FIRST_NAMES = [
  'Alexandre',
  'Thomas',
  'Julien',
  'Nicolas',
  'Maxime',
  'Lucas',
  'Antoine',
  'Romain',
  'Guillaume',
  'Clément',
  'Hugo',
  'Valentin',
  'Mathieu',
  'Florian',
  'Adrien',
  'Quentin',
  'Benjamin',
  'Pierre',
  'Louis',
  'Arthur',
  'Paul',
  'Théo',
  'Baptiste',
  'Gabriel',
  'Camille',
  'Emma',
  'Léa',
  'Chloé',
  'Manon',
  'Inès',
  'Sarah',
  'Laura',
  'Marine',
  'Juliette',
  'Lucie',
  'Clara',
  'Marie',
  'Anaïs',
  'Pauline',
  'Océane'
];

const LAST_NAMES = [
  'Martin',
  'Bernard',
  'Dubois',
  'Thomas',
  'Robert',
  'Richard',
  'Petit',
  'Durand',
  'Leroy',
  'Moreau',
  'Simon',
  'Laurent',
  'Lefebvre',
  'Michel',
  'Garcia',
  'David',
  'Bertrand',
  'Roux',
  'Vincent',
  'Fournier',
  'Morel',
  'Girard',
  'André',
  'Lefevre',
  'Mercier',
  'Dupont',
  'Lambert',
  'Bonnet',
  'François',
  'Martinez',
  'Legrand',
  'Garnier',
  'Faure',
  'Rousseau',
  'Blanc',
  'Guérin',
  'Müller',
  'Henry',
  'Roussel',
  'Nicolas'
];

function getRandomIdentity() {

  const firstName =
    FIRST_NAMES[
      Math.floor(
        Math.random() *
        FIRST_NAMES.length
      )
    ];

  const lastName =
    LAST_NAMES[
      Math.floor(
        Math.random() *
        LAST_NAMES.length
      )
    ];

  return {
    firstName,
    lastName
  };
}

// ============================================================
// 4. SESSION CACHE
// ============================================================
//
// Session temporaire uniquement.
// Les données importantes sont sauvegardées PostgreSQL.
// Une session Telegram peut être perdue après restart,
// mais les users/tasks/balances ne le seront pas.
//

const userSessions = {};

// ============================================================
// 5. DATABASE INITIALIZATION
// ============================================================

async function initializeBotDatabase() {

  console.log(
    '🗄️ Vérification PostgreSQL...'
  );

  await dbQuery(`
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

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS wallets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
      balance NUMERIC(12,4) NOT NULL DEFAULT 0,
      total_earned NUMERIC(12,4) NOT NULL DEFAULT 0,
      total_withdrawn NUMERIC(12,4) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await dbQuery(`
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

      reward_usd NUMERIC(12,4) DEFAULT 0,

      validation_status TEXT DEFAULT 'pending',
      validation_reason TEXT,
      validated_at TIMESTAMPTZ,
      validated_by INTEGER,

      account_created BOOLEAN NOT NULL DEFAULT FALSE,
      account_created_at TIMESTAMPTZ,

      reward_paid BOOLEAN NOT NULL DEFAULT FALSE,
      reward_paid_at TIMESTAMPTZ,

      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,

      user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      task_id TEXT,

      type TEXT NOT NULL,

      amount NUMERIC(12,4) NOT NULL,

      balance_before NUMERIC(12,4) NOT NULL,

      balance_after NUMERIC(12,4) NOT NULL,

      description TEXT,

      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id SERIAL PRIMARY KEY,

      user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      amount NUMERIC(12,4) NOT NULL,

      method TEXT,

      destination TEXT,

      status TEXT NOT NULL DEFAULT 'pending',

      created_at TIMESTAMPTZ DEFAULT NOW(),

      processed_at TIMESTAMPTZ
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS task_validations (
      id SERIAL PRIMARY KEY,

      task_id TEXT NOT NULL
        REFERENCES tasks(task_id)
        ON DELETE CASCADE,

      validator_id INTEGER,

      status TEXT NOT NULL DEFAULT 'pending',

      reason TEXT,

      validation_data JSONB DEFAULT '{}'::jsonb,

      validated_at TIMESTAMPTZ,

      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,

      task_id TEXT UNIQUE NOT NULL
        REFERENCES tasks(task_id)
        ON DELETE CASCADE,

      uid TEXT NOT NULL,

      first_name TEXT,

      last_name TEXT,

      account_status TEXT NOT NULL DEFAULT 'active',

      validated_at TIMESTAMPTZ NOT NULL,

      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS validation_reports (
      id SERIAL PRIMARY KEY,

      task_id TEXT NOT NULL
        REFERENCES tasks(task_id)
        ON DELETE CASCADE,

      validation_id INTEGER
        REFERENCES task_validations(id)
        ON DELETE SET NULL,

      result TEXT NOT NULL,

      checks JSONB DEFAULT '{}'::jsonb,

      notes TEXT,

      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ----------------------------------------------------------
  // MIGRATIONS
  // ----------------------------------------------------------

  await dbQuery(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referral_by TEXT;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referrals_count INTEGER
      NOT NULL DEFAULT 0;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referral_earnings
      NUMERIC(12,4) NOT NULL DEFAULT 0;
  `);

  await dbQuery(`
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS validation_status TEXT
      DEFAULT 'pending';

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS validation_reason TEXT;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS validated_by INTEGER;

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
  `);

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS
      idx_tasks_status
      ON tasks(status);

    CREATE INDEX IF NOT EXISTS
      idx_tasks_validation_status
      ON tasks(validation_status);

    CREATE INDEX IF NOT EXISTS
      idx_tasks_telegram_user_id
      ON tasks(telegram_user_id);

    CREATE INDEX IF NOT EXISTS
      idx_task_validations_task_id
      ON task_validations(task_id);

    CREATE INDEX IF NOT EXISTS
      idx_task_validations_status
      ON task_validations(status);
  `);

  console.log(
    '✅ PostgreSQL prêt.'
  );
}

// ============================================================
// 6. USER DATABASE FUNCTIONS
// ============================================================

async function getUserData(
  userId,
  username,
  firstName
) {

  const telegramId =
    String(userId);

  let result =
    await dbQuery(
      `
      SELECT
        u.*,

        COALESCE(
          w.balance,
          0
        ) AS balance,

        COALESCE(
          w.total_earned,
          0
        ) AS total_earned,

        COALESCE(
          w.total_withdrawn,
          0
        ) AS total_withdrawn

      FROM users u

      LEFT JOIN wallets w
        ON w.user_id = u.id

      WHERE u.telegram_user_id = $1

      LIMIT 1
      `,
      [telegramId]
    );

  if (result.rows.length === 0) {

    result =
      await dbQuery(
        `
        INSERT INTO users (
          telegram_user_id,
          telegram_username,
          first_name
        )

        VALUES ($1,$2,$3)

        RETURNING *
        `,
        [
          telegramId,
          username || '',
          firstName || 'Opérateur'
        ]
      );

    const user =
      result.rows[0];

    await dbQuery(
      `
      INSERT INTO wallets (
        user_id
      )

      VALUES ($1)

      ON CONFLICT (user_id)
      DO NOTHING
      `,
      [user.id]
    );

    return {
      ...user,
      balance: 0,
      total_earned: 0,
      total_withdrawn: 0
    };
  }

  const user =
    result.rows[0];

  // Update Telegram profile
  await dbQuery(
    `
    UPDATE users

    SET
      telegram_username =
        COALESCE($2, telegram_username),

      first_name =
        COALESCE($3, first_name),

      updated_at = NOW()

    WHERE telegram_user_id = $1
    `,
    [
      telegramId,
      username || null,
      firstName || null
    ]
  );

  return user;
}

// ============================================================
// REFRESH USER
// ============================================================

async function refreshUser(
  userId
) {

  const result =
    await dbQuery(
      `
      SELECT
        u.*,

        COALESCE(
          w.balance,
          0
        ) AS balance,

        COALESCE(
          w.total_earned,
          0
        ) AS total_earned,

        COALESCE(
          w.total_withdrawn,
          0
        ) AS total_withdrawn

      FROM users u

      LEFT JOIN wallets w
        ON w.user_id = u.id

      WHERE u.telegram_user_id = $1
      `,
      [String(userId)]
    );

  return result.rows[0] || null;
}

// ============================================================
// 7. TRANSLATIONS
// ============================================================

const TRANSLATIONS = {

  fr: {

    welcome:
      `👋 *Bienvenue sur ${PLATFORM_NAME} (@TaskifyProBot) !*\n\n` +
      `Plateforme automatisée de gestion et soumission de tâches rémunérées.\n\n` +
      `Utilisez le menu ci-dessous pour démarrer vos tâches, suivre vos gains ou demander un retrait.\n\n` +
      `👉 Cliquez sur *📋 Tâches* pour débuter.`,

    choose_task:
      `📋 *Menu des Tâches Disponibles*\n\n` +
      `Sélectionnez une catégorie de tâche à effectuer.`,

    balance_title:
      `💰 *Votre Solde & Activité*`,

    withdrawal_title:
      `🏦 *Demande de Retrait*`,

    support_title:
      `📞 *Support & Assistance*`,

    referral_title:
      `👥 *Programme de Parrainage*`,

    leaderboard_title:
      `🏆 *Classement des Meilleurs Opérateurs*`,

    lang_title:
      `🪩 *Sélection de la Langue*`
  },

  mg: {

    welcome:
      `👋 *Tongasoa eto amin'ny ${PLATFORM_NAME} (@TaskifyProBot) !*\n\n` +
      `Sehatra fitantanana asa sy fandefasana tâche.\n\n` +
      `Ampiasao ny menu eto ambany hijerena asa, solde na retrait.\n\n` +
      `👉 Tsindrio *📋 Tâches* hanombohana.`,

    choose_task:
      `📋 *Safidy ny Asa*\n\n` +
      `Fidio ny asa tianao hatao.`,

    balance_title:
      `💰 *Ny Solde sy ny Asanao*`,

    withdrawal_title:
      `🏦 *Fangatahana Retrait*`,

    support_title:
      `📞 *Fanampiana & Support*`,

    referral_title:
      `👥 *Parrainage*`,

    leaderboard_title:
      `🏆 *Classement*`,

    lang_title:
      `🪩 *Fisafidianana Fiteny*`
  },

  en: {

    welcome:
      `👋 *Welcome to ${PLATFORM_NAME} (@TaskifyProBot)!*\n\n` +
      `Automated task management and submission platform.\n\n` +
      `Use the menu below to start tasks, track earnings or request withdrawals.\n\n` +
      `👉 Click *📋 Tâches* to begin.`,

    choose_task:
      `📋 *Available Tasks*\n\n` +
      `Select a task category.`,

    balance_title:
      `💰 *Your Balance & Activity*`,

    withdrawal_title:
      `🏦 *Withdrawal Request*`,

    support_title:
      `📞 *Support & Help*`,

    referral_title:
      `👥 *Referral Program*`,

    leaderboard_title:
      `🏆 *Leaderboard*`,

    lang_title:
      `🪩 *Language Selection*`
  }
};

// ============================================================
// 8. GOOGLE SHEETS SYNC
// ============================================================

async function syncToGoogleSheets(task) {

  if (
    !GOOGLE_SHEET_WEBHOOK_URL ||
    !GOOGLE_SHEET_WEBHOOK_URL.startsWith('http')
  ) {

    console.log(
      `[Google Sheets] Webhook non configuré. Task=${task.id}`
    );

    return {
      success: false,
      reason: 'URL_NOT_CONFIGURED'
    };
  }

  const payload = {

    action:
      task.syncAction ||
      'insert_task',

    id:
      task.id,

    timestamp:
      task.timestamp ||
      new Date().toISOString(),

    uid:
      task.uid || '',

    firstName:
      task.firstName || '',

    lastName:
      task.lastName || '',

    telegramUserId:
      String(
        task.telegramUserId || ''
      ),

    telegramUsername:
      task.telegramUsername || '',

    status:
      task.status || 'pending',

    validation_status:
      task.validation_status || 'pending',

    validation_reason:
      task.validation_reason || null,

    validated_at:
      task.validated_at || null,

    validated_by:
      task.validated_by || null,

    reward_amount:
      Number(
        task.reward_amount ||
        TASK_REWARD_EUR
      ),

    reward_paid:
      Boolean(
        task.reward_paid
      ),

    reward_paid_at:
      task.reward_paid_at || null,

    account_created:
      Boolean(
        task.account_created
      ),

    account_created_at:
      task.account_created_at || null,

    taskType:
      task.taskType || 'Facebook',

    notes:
      task.notes ||
      `Enregistré via ${PLATFORM_NAME}`
  };

  console.log(
    `[Google Sheets] 📡 ${payload.action} ${payload.id}`
  );

  try {

    const controller =
      new AbortController();

    const timeoutId =
      setTimeout(
        () => controller.abort(),
        15000
      );

    const response =
      await fetch(
        GOOGLE_SHEET_WEBHOOK_URL,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            'Accept':
              'application/json, text/plain, */*'
          },

          body:
            JSON.stringify(payload),

          signal:
            controller.signal
        }
      );

    clearTimeout(
      timeoutId
    );

    const responseText =
      await response.text();

    if (
      response.ok ||
      response.status < 400
    ) {

      console.log(
        `[Google Sheets] ✅ ${payload.id}`
      );

      return {
        success: true,
        statusCode:
          response.status,
        body:
          responseText
      };
    }

    console.error(
      `[Google Sheets] ❌ HTTP ${response.status}`
    );

    return {
      success: false,
      statusCode:
        response.status,
      body:
        responseText
    };

  } catch (error) {

    console.error(
      '[Google Sheets] ❌',
      error.message
    );

    return {
      success: false,
      error:
        error.message
    };
  }
}

// ============================================================
// 9. UI RENDER
// ============================================================

async function renderScreen(
  ctx,
  text,
  extra = {}
) {

  try {

    if (
      ctx.callbackQuery &&
      ctx.callbackQuery.message
    ) {

      return await ctx.editMessageText(
        text,
        {
          parse_mode: 'Markdown',
          ...extra
        }
      );
    }

  } catch (error) {

    if (
      !error.message ||
      !error.message.includes(
        'message is not modified'
      )
    ) {

      console.warn(
        '[UI Render]',
        error.message
      );
    }
  }

  return ctx.reply(
    text,
    {
      parse_mode: 'Markdown',
      ...extra
    }
  );
}

// ============================================================
// 10. START
// ============================================================

bot.start(
  async ctx => {

    const userId =
      String(
        ctx.from?.id || 'unknown'
      );

    const username =
      ctx.from?.username || '';

    const firstName =
      ctx.from?.first_name ||
      'Opérateur';

    const user =
      await getUserData(
        userId,
        username,
        firstName
      );

    userSessions[userId] = {
      step: 'START'
    };

    // --------------------------------------------------------
    // REFERRAL
    // --------------------------------------------------------

    const startPayload =
      ctx.message.text
        .split(' ')[1];

    if (
      startPayload &&
      startPayload.startsWith('ref_')
    ) {

      const referrerId =
        startPayload.replace(
          'ref_',
          ''
        );

      if (
        referrerId !== userId &&
        !user.referral_by
      ) {

        await dbQuery(
          `
          UPDATE users

          SET
            referral_by = $1,
            updated_at = NOW()

          WHERE telegram_user_id = $2
          `,
          [
            referrerId,
            userId
          ]
        );

        await dbQuery(
          `
          UPDATE users

          SET
            referrals_count =
              referrals_count + 1,

            updated_at = NOW()

          WHERE telegram_user_id = $1
          `,
          [referrerId]
        );

        console.log(
          `[Referral] ${userId} ← ${referrerId}`
        );
      }
    }

    const lang =
      user.language || 'fr';

    const t =
      TRANSLATIONS[lang] ||
      TRANSLATIONS.fr;

    await ctx.reply(
      t.welcome,
      {
        parse_mode: 'Markdown',
        ...WORKER_MAIN_KEYBOARD
      }
    );
  }
);

// ============================================================
// HELP
// ============================================================

bot.help(
  async ctx => {

    await ctx.reply(

      `📌 *Guide d'utilisation - ${PLATFORM_NAME}*\n\n` +

      `1. Cliquez sur *📋 Tâches*.\n` +

      `2. Sélectionnez la tâche disponible.\n` +

      `3. Suivez les instructions de soumission.\n` +

      `4. Envoyez votre UID lorsque demandé.\n` +

      `5. Votre soumission est d'abord enregistrée avec le statut *PENDING*.\n` +

      `6. Un administrateur vérifie ensuite la soumission.\n` +

      `7. La récompense est créditée uniquement après validation.\n\n` +

      `⚠️ Ne transmettez jamais de mot de passe personnel ni de jeton de session dans le chat.`,

      {
        parse_mode: 'Markdown',

        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🚀 Démarrer une Tâche',
              'task_facebook'
            )
          ],

          [
            Markup.button.callback(
              '📞 Support',
              'action_contact_support'
            )
          ]
        ])
      }
    );
  }
);

// ============================================================
// 11. BALANCE
// ============================================================

async function handleBalanceMenu(ctx) {

  const userId =
    String(
      ctx.from?.id || 'unknown'
    );

  const user =
    await refreshUser(
      userId
    );

  if (!user) {

    return ctx.reply(
      '❌ Utilisateur introuvable.'
    );
  }

  const pendingResult =
    await dbQuery(
      `
      SELECT
        COUNT(*)::int AS count,

        COALESCE(
          SUM(reward_usd),
          0
        ) AS amount

      FROM tasks

      WHERE telegram_user_id = $1

        AND validation_status =
          'pending'
      `,
      [userId]
    );

  const pendingCount =
    Number(
      pendingResult.rows[0]?.count || 0
    );

  const pendingAmount =
    Number(
      pendingResult.rows[0]?.amount || 0
    );

  const completedResult =
    await dbQuery(
      `
      SELECT COUNT(*)::int AS count

      FROM tasks

      WHERE telegram_user_id = $1

        AND validation_status =
          'validated'
      `,
      [userId]
    );

  const completed =
    Number(
      completedResult.rows[0]?.count || 0
    );

  userSessions[userId] = {
    step: 'START'
  };

  await ctx.reply(

    `💰 *Votre Solde & Activité*\n\n` +

    `👤 Utilisateur : *${user.first_name || 'Opérateur'}*\n` +

    `🆔 ID : \`${user.telegram_user_id}\`\n\n` +

    `💵 *Solde disponible :* ` +
    `\`${Number(user.balance || 0).toFixed(2)} €\`\n\n` +

    `⏳ *Tâches PENDING :* ` +
    `\`${pendingCount}\`\n` +

    `💵 *Rewards en attente :* ` +
    `\`${pendingAmount.toFixed(2)} €\`\n\n` +

    `📊 *Tâches validées :* ` +
    `\`${completed}\`\n\n` +

    `💎 *Total gagné :* ` +
    `\`${Number(user.total_earned || 0).toFixed(2)} €\`\n\n` +

    `_Les rewards PENDING ne sont pas inclus dans le solde disponible._`,

    {
      parse_mode: 'Markdown',

      ...MAIN_REPLY_KEYBOARD,

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📋 Mes tâches',
            'action_my_tasks'
          )
        ],

        [
          Markup.button.callback(
            '🚀 Nouvelle tâche',
            'task_facebook'
          )
        ],

        [
          Markup.button.callback(
            '🏦 Demander un retrait',
            'action_request_withdrawal'
          )
        ]
      ])
    }
  );
}

// ============================================================
// 12. TASK MENU
// ============================================================

async function handleTasksMenu(ctx) {

  const userId =
    String(
      ctx.from?.id || 'unknown'
    );

  userSessions[userId] = {
    step: 'AUTH_CHOICE',
    taskType: 'Facebook'
  };

  await ctx.reply(

    `🌐 *Tâche : Facebook*\n\n` +

    `💵 Reward par tâche validée : ` +
    `*${TASK_REWARD_EUR.toFixed(2)} €*\n\n` +

    `📌 *Important :*\n` +

    `La soumission est d'abord enregistrée en *PENDING*.\n` +

    `Elle sera ensuite vérifiée par un administrateur.\n` +

    `Le reward n'est crédité qu'après validation.\n\n` +

    `Sélectionnez la méthode disponible :`,

    {
      parse_mode: 'Markdown',

      ...MAIN_REPLY_KEYBOARD,

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🍪 Cookies',
            'auth_cookies'
          ),

          Markup.button.callback(
            '🔐 2FA',
            'auth_2fa'
          )
        ],

        [
          Markup.button.callback(
            'ℹ️ Consignes',
            'action_task_rules'
          )
        ],

        [
          Markup.button.callback(
            '❌ Annuler',
            'action_cancel'
          )
        ]
      ])
    }
  );
}

// ============================================================
// 13. WITHDRAWAL
// ============================================================

async function handleWithdrawalMenu(ctx) {

  const userId =
    String(
      ctx.from?.id || 'unknown'
    );

  const user =
    await refreshUser(
      userId
    );

  if (!user) {

    return ctx.reply(
      '❌ Utilisateur introuvable.'
    );
  }

  const balance =
    Number(
      user.balance || 0
    );

  const eligible =
    balance >=
    MIN_WITHDRAWAL_EUR;

  await ctx.reply(

    `🏦 *Demande de Retrait*\n\n` +

    `💵 Solde disponible : ` +
    `*${balance.toFixed(2)} €*\n` +

    `🎯 Minimum : ` +
    `*${MIN_WITHDRAWAL_EUR.toFixed(2)} €*\n\n` +

    (
      eligible
        ? `🟢 *Vous êtes éligible.*`
        : `🟡 *Solde insuffisant pour le moment.*`
    ),

    {
      parse_mode: 'Markdown',

      ...MAIN_REPLY_KEYBOARD,

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📱 Mobile Money',
            'withdraw_mobile_money'
          )
        ],

        [
          Markup.button.callback(
            '🪙 USDT',
            'withdraw_crypto'
          )
        ],

        [
          Markup.button.callback(
            '💳 Virement',
            'withdraw_bank'
          )
        ]
      ])
    }
  );
}

// ============================================================
// 14. SUPPORT
// ============================================================

async function handleSupportMenu(ctx) {

  await ctx.reply(

    `📞 *Support & Assistance*\n\n` +

    `Pour toute question concernant votre tâche, ` +
    `votre validation ou votre paiement, contactez le support officiel.\n\n` +

    `👤 Support : @TaskifySupport\n\n` +

    `_Ne transmettez jamais de mot de passe personnel ni de jeton de session dans le chat._`,

    {
      parse_mode: 'Markdown',

      ...MAIN_REPLY_KEYBOARD,

      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            '💬 Ouvrir le Support',
            'https://t.me/TaskifySupport'
          )
        ]
      ])
    }
  );
}

// ============================================================
// 15. REFERRAL
// ============================================================

async function handleReferralMenu(ctx) {

  const userId =
    String(
      ctx.from?.id || 'unknown'
    );

  const user =
    await refreshUser(
      userId
    );

  if (!user) {
    return;
  }

  const botUsername =
    ctx.botInfo?.username ||
    'TaskifyProBot';

  const refLink =
    `https://t.me/${botUsername}?start=ref_${userId}`;

  await ctx.reply(

    `👥 *Programme de Parrainage*\n\n` +

    `📊 Filleuls : ` +
    `\`${Number(user.referrals_count || 0)}\`\n\n` +

    `💵 Commissions : ` +
    `\`${Number(user.referral_earnings || 0).toFixed(2)} €\`\n\n` +

    `🔗 *Votre lien :*\n` +

    `\`${refLink}\``,

    {
      parse_mode: 'Markdown',

      ...MAIN_REPLY_KEYBOARD,

      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            '📤 Partager',
            `https://t.me/share/url?url=${encodeURIComponent(refLink)}`
          )
        ]
      ])
    }
  );
}

// ============================================================
// 16. LEADERBOARD
// ============================================================

async function handleLeaderboardMenu(ctx) {

  const result =
    await dbQuery(
      `
      SELECT
        u.telegram_user_id,
        u.first_name,
        COALESCE(
          COUNT(t.id),
          0
        )::int AS completed

      FROM users u

      LEFT JOIN tasks t
        ON t.telegram_user_id =
           u.telegram_user_id

        AND t.validation_status =
            'validated'

      GROUP BY
        u.id,
        u.telegram_user_id,
        u.first_name

      ORDER BY completed DESC

      LIMIT 10
      `
    );

  let message =
    `🏆 *Classement des Opérateurs*\n\n`;

  if (result.rows.length === 0) {

    message +=
      `Aucune tâche validée pour le moment.`;

  } else {

    result.rows.forEach(
      (row, index) => {

        message +=
          `${index + 1}. ` +
          `${row.first_name || 'Opérateur'} — ` +
          `\`${row.completed} validées\`\n`;
      }
    );
  }

  await ctx.reply(
    message,
    {
      parse_mode: 'Markdown',

      ...MAIN_REPLY_KEYBOARD
    }
  );
}

// ============================================================
// 17. LANGUAGE
// ============================================================

async function handleLanguageMenu(ctx) {

  await ctx.reply(

    `🪩 *Sélection de la Langue*\n\n` +
    `Choisissez votre langue :`,

    {
      parse_mode: 'Markdown',

      ...MAIN_REPLY_KEYBOARD,

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🇫🇷 Français',
            'set_lang_fr'
          ),

          Markup.button.callback(
            '🇲🇬 Malagasy',
            'set_lang_mg'
          ),

          Markup.button.callback(
            '🇬🇧 English',
            'set_lang_en'
          )
        ]
      ])
    }
  );
}

// ============================================================
// 18. KEYBOARD HANDLERS
// ============================================================

bot.hears(
  [
    '💰 Solde',
    'Solde',
    'solde',
    '/balance',
    '/solde'
  ],
  handleBalanceMenu
);

bot.hears(
  [
    '📋 Tâches',
    '📋 Taches',
    'Tâches',
    'Taches',
    '/tasks',
    '/taches',
    '/task'
  ],
  handleTasksMenu
);

bot.hears(
  [
    '🏦 Retrait',
    'Retrait',
    'retrait',
    '/withdraw',
    '/retrait'
  ],
  handleWithdrawalMenu
);

bot.hears(
  [
    '📞 Support',
    'Support',
    'support',
    '/support'
  ],
  handleSupportMenu
);

bot.hears(
  [
    '👥 Parrainages',
    'Parrainage',
    'Parrainages',
    '/referral',
    '/parrainage'
  ],
  handleReferralMenu
);

bot.hears(
  [
    '🏆 Classement',
    'Classement',
    'classement',
    '/leaderboard',
    '/top'
  ],
  handleLeaderboardMenu
);

bot.hears(
  [
    '🪩 Langue',
    'Langue',
    'langue',
    'Language',
    '/language',
    '/langue'
  ],
  handleLanguageMenu
);

// ============================================================
// 19. LANGUAGE CALLBACKS
// ============================================================

async function setLanguage(
  ctx,
  language,
  message
) {

  const userId =
    String(
      ctx.from?.id || 'unknown'
    );

  await dbQuery(
    `
    UPDATE users

    SET
      language = $1,
      updated_at = NOW()

    WHERE telegram_user_id = $2
    `,
    [
      language,
      userId
    ]
  );

  await ctx.answerCbQuery(
    message
  );

  await renderScreen(
    ctx,
    message,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '📋 Tâches',
          'task_facebook'
        )
      ],

      [
        Markup.button.callback(
          '💰 Solde',
          'action_check_balance'
        )
      ]
    ])
  );
}

bot.action(
  'set_lang_fr',
  ctx =>
    setLanguage(
      ctx,
      'fr',
      '🇫🇷 Langue configurée en Français.'
    )
);

bot.action(
  'set_lang_mg',
  ctx =>
    setLanguage(
      ctx,
      'mg',
      '🇲🇬 Voafidy ny teny Malagasy.'
    )
);

bot.action(
  'set_lang_en',
  ctx =>
    setLanguage(
      ctx,
      'en',
      '🇬🇧 Language updated to English.'
    )
);

// ============================================================
// 20. TASK FLOW
// ============================================================

bot.action(
  'task_facebook',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(
        ctx.from?.id || 'unknown'
      );

    userSessions[userId] = {
      step: 'AUTH_CHOICE',
      taskType: 'Facebook'
    };

    await renderScreen(

      ctx,

      `🌐 *Tâche Facebook*\n\n` +

      `💵 Reward : ` +
      `*${TASK_REWARD_EUR.toFixed(2)} €*\n\n` +

      `📌 La tâche sera d'abord enregistrée en *PENDING*.\n\n` +

      `Après vérification par un administrateur :\n` +

      `✅ VALIDATED → reward crédité\n` +

      `❌ REJECTED → aucun reward`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🍪 Continuer',
            'auth_cookies'
          )
        ],

        [
          Markup.button.callback(
            '❌ Annuler',
            'action_cancel'
          )
        ]
      ])
    );
  }
);

// ============================================================
// 21. 2FA
// ============================================================

bot.action(
  'auth_2fa',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `⚠️ *2FA indisponible*\n\n` +

      `Cette méthode n'est momentanément pas disponible.`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🍪 Continuer',
            'auth_cookies'
          )
        ],

        [
          Markup.button.callback(
            '❌ Annuler',
            'action_cancel'
          )
        ]
      ])
    );
  }
);

// ============================================================
// 22. COOKIE STEP
// ============================================================

bot.action(
  'auth_cookies',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(
        ctx.from?.id || 'unknown'
      );

    const identity =
      getRandomIdentity();

    userSessions[userId] = {

      step:
        'CREDENTIALS_SHOWN',

      taskType:
        'Facebook',

      firstName:
        identity.firstName,

      lastName:
        identity.lastName,

      password:
        DEFAULT_BOT_PASSWORD
    };

    await renderScreen(

      ctx,

      `⚠️ *Informations de tâche*\n\n` +

      `✅ Prénom : ` +
      `\`${identity.firstName}\`\n` +

      `✅ Nom : ` +
      `\`${identity.lastName}\`\n` +

      `🔐 Mot de passe assigné : ` +
      `\`${DEFAULT_BOT_PASSWORD}\`\n\n` +

      `Une fois la tâche préparée, cliquez sur *Envoyer l'UID*.`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📥 Envoyer UID',
            'action_send_uid'
          )
        ],

        [
          Markup.button.callback(
            '❌ Annuler',
            'action_cancel'
          )
        ]
      ])
    );
  }
);

// ============================================================
// 23. SEND UID
// ============================================================

bot.action(
  'action_send_uid',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(
        ctx.from?.id || 'unknown'
      );

    if (!userSessions[userId]) {

      userSessions[userId] = {
        taskType: 'Facebook'
      };
    }

    userSessions[userId].step =
      'AWAITING_UID';

    await renderScreen(

      ctx,

      `✍️ *Envoi de l'UID*\n\n` +

      `Veuillez envoyer votre UID numérique.`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '❌ Annuler',
            'action_cancel'
          )
        ]
      ])
    );
  }
);

// ============================================================
// 24. CANCEL
// ============================================================

bot.action(
  'action_cancel',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(
        ctx.from?.id || 'unknown'
      );

    delete userSessions[userId];

    await renderScreen(

      ctx,

      `❌ *Processus annulé.*\n\n` +
      `Aucune nouvelle tâche n'a été enregistrée.`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🚀 Nouvelle tâche',
            'task_facebook'
          )
        ]
      ])
    );
  }
);

// ============================================================
// 25. TASK RULES
// ============================================================

bot.action(
  'action_task_rules',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `📋 *Consignes*\n\n` +

      `1. Utilisez les informations fournies par le bot.\n` +

      `2. Ne soumettez pas deux fois le même UID.\n` +

      `3. La tâche est enregistrée en PENDING après soumission.\n` +

      `4. Un administrateur effectue la validation.\n` +

      `5. Le reward est crédité uniquement après VALIDATION.\n\n` +

      `⚠️ Ne transmettez jamais de mot de passe personnel ni de jeton de session dans le chat.`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ Compris',
            'task_facebook'
          )
        ]
      ])
    );
  }
);

// ============================================================
// 26. TEXT INPUT
// ============================================================

bot.on(
  'text',
  async ctx => {

    const userId =
      String(
        ctx.from?.id || 'unknown'
      );

    const username =
      ctx.from?.username || '';

    const firstName =
      ctx.from?.first_name ||
      'Opérateur';

    const text =
      ctx.message.text.trim();

    const lowerText =
      text.toLowerCase();

    // --------------------------------------------------------
    // MENU
    // --------------------------------------------------------

    if (
      lowerText === 'solde' ||
      lowerText === '/solde' ||
      lowerText === '/balance' ||
      text.includes('💰 Solde')
    ) {
      return handleBalanceMenu(ctx);
    }

    if (
      lowerText === 'taches' ||
      lowerText === 'tâches' ||
      lowerText === '/tasks' ||
      lowerText === '/taches' ||
      lowerText === '/task' ||
      text.includes('📋 Tâches')
    ) {
      return handleTasksMenu(ctx);
    }

    if (
      lowerText === 'retrait' ||
      lowerText === '/withdraw' ||
      lowerText === '/retrait' ||
      text.includes('🏦 Retrait')
    ) {
      return handleWithdrawalMenu(ctx);
    }

    if (
      lowerText === 'support' ||
      lowerText === '/support' ||
      text.includes('📞 Support')
    ) {
      return handleSupportMenu(ctx);
    }

    if (
      lowerText === 'parrainage' ||
      lowerText === 'parrainages' ||
      lowerText === '/referral' ||
      text.includes('👥 Parrainage')
    ) {
      return handleReferralMenu(ctx);
    }

    if (
      lowerText === 'classement' ||
      lowerText === '/leaderboard' ||
      lowerText === '/top' ||
      text.includes('🏆 Classement')
    ) {
      return handleLeaderboardMenu(ctx);
    }

    if (
      lowerText === 'langue' ||
      lowerText === 'language' ||
      lowerText === '/language' ||
      lowerText === '/langue' ||
      text.includes('🪩 Langue')
    ) {
      return handleLanguageMenu(ctx);
    }

    // --------------------------------------------------------
    // SESSION
    // --------------------------------------------------------

    const session =
      userSessions[userId];

    if (
      !session ||
      !session.step ||
      session.step === 'START'
    ) {

      const user =
        await getUserData(
          userId,
          username,
          firstName
        );

      return ctx.reply(

        `👋 Bonjour *${user.first_name || firstName}* !\n\n` +

        `Utilisez le menu ci-dessous.`,

        {
          parse_mode: 'Markdown',

          ...MAIN_REPLY_KEYBOARD
        }
      );
    }

    // --------------------------------------------------------
    // UID
    // --------------------------------------------------------

    if (
      session.step ===
      'AWAITING_UID'
    ) {

      if (
        !/^\d{5,20}$/.test(text)
      ) {

        return ctx.reply(

          `⚠️ *UID invalide.*\n\n` +
          `Envoyez uniquement l'UID numérique.`,

          {
            parse_mode: 'Markdown'
          }
        );
      }

      // Check duplicate UID
      const duplicate =
        await dbQuery(
          `
          SELECT task_id
          FROM tasks
          WHERE uid = $1
          LIMIT 1
          `,
          [text]
        );

      if (
        duplicate.rows.length > 0
      ) {

        return ctx.reply(

          `⚠️ *UID déjà soumis.*\n\n` +

          `Cet UID existe déjà dans le système.`,

          {
            parse_mode: 'Markdown'
          }
        );
      }

      session.uid =
        text;

      session.step =
        'AWAITING_SUBMISSION';

      await ctx.reply(

        `✅ *UID reçu.*\n\n` +

        `La soumission peut maintenant être enregistrée.\n\n` +

        `📌 Statut initial : *PENDING*\n\n` +

        `⚠️ Aucun reward ne sera crédité avant la validation administrateur.`,

        {
          parse_mode: 'Markdown',

          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '✅ Confirmer la soumission',
                'confirm_task_submission'
              )
            ],

            [
              Markup.button.callback(
                '❌ Annuler',
                'action_cancel'
              )
            ]
          ])
        }
      );

      return;
    }

    // --------------------------------------------------------
    // LEGACY SUBMISSION
    // --------------------------------------------------------

    if (
      session.step ===
      'AWAITING_SUBMISSION'
    ) {

      return ctx.reply(

        `ℹ️ Utilisez le bouton *Confirmer la soumission* pour enregistrer la tâche.`,

        {
          parse_mode: 'Markdown'
        }
      );
    }
  }
);

// ============================================================
// 27. CONFIRM TASK SUBMISSION
// ============================================================

bot.action(
  'confirm_task_submission',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(
        ctx.from?.id || 'unknown'
      );

    const username =
      ctx.from?.username ||
      '';

    const telegramFirstName =
      ctx.from?.first_name ||
      'Opérateur';

    const session =
      userSessions[userId];

    if (
      !session ||
      session.step !==
      'AWAITING_SUBMISSION'
    ) {

      return renderScreen(

        ctx,

        `⚠️ *Session expirée.*\n\n` +
        `Veuillez recommencer la tâche.`,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🚀 Nouvelle tâche',
              'task_facebook'
            )
          ]
        ])
      );
    }

    const taskId =
      `task-${Date.now()}-${userId}`;

    const user =
      await getUserData(
        userId,
        username,
        telegramFirstName
      );

    const firstName =
      session.firstName ||
      user.first_name ||
      telegramFirstName;

    const lastName =
      session.lastName ||
      user.last_name ||
      '';

    // --------------------------------------------------------
    // INSERT DATABASE
    // --------------------------------------------------------

    const client =
      await pool.connect();

    try {

      await client.query(
        'BEGIN'
      );

      // Duplicate protection
      const duplicate =
        await client.query(
          `
          SELECT task_id
          FROM tasks
          WHERE uid = $1
          LIMIT 1
          FOR UPDATE
          `,
          [
            session.uid
          ]
        );

      if (
        duplicate.rows.length > 0
      ) {

        await client.query(
          'ROLLBACK'
        );

        delete userSessions[userId];

        return renderScreen(

          ctx,

          `⚠️ *UID déjà enregistré.*\n\n` +
          `Cette soumission existe déjà.`,

          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '📋 Mes tâches',
                'action_my_tasks'
              )
            ]
          ])
        );
      }

      const taskResult =
        await client.query(
          `
          INSERT INTO tasks (

            task_id,

            telegram_user_id,

            task_type,

            status,

            validation_status,

            uid,

            first_name,

            last_name,

            reward_usd,

            reward_paid,

            validated_at,

            validated_by,

            validation_reason,

            account_created,

            account_created_at,

            created_at

          )

          VALUES (

            $1,
            $2,
            $3,
            'pending',
            'pending',
            $4,
            $5,
            $6,
            $7,
            FALSE,
            NULL,
            NULL,
            NULL,
            FALSE,
            NULL,
            NOW()

          )

          RETURNING *
          `,
          [
            taskId,

            userId,

            session.taskType ||
              'Facebook',

            session.uid,

            firstName,

            lastName,

            TASK_REWARD_EUR
          ]
        );

      await client.query(
        'COMMIT'
      );

      const task =
        taskResult.rows[0];

      // ------------------------------------------------------
      // GOOGLE SHEETS
      // ------------------------------------------------------

      await syncToGoogleSheets({

        id:
          task.task_id,

        uid:
          task.uid,

        firstName:
          task.first_name,

        lastName:
          task.last_name,

        telegramUserId:
          task.telegram_user_id,

        telegramUsername:
          username,

        status:
          'pending',

        validation_status:
          'pending',

        reward_amount:
          TASK_REWARD_EUR,

        reward_paid:
          false,

        account_created:
          false,

        timestamp:
          task.created_at,

        taskType:
          task.task_type,

        notes:
          `Soumission PENDING via ${PLATFORM_NAME}.`
      });

      delete userSessions[userId];

      await renderScreen(

        ctx,

        `⏳ *Soumission enregistrée !*\n\n` +

        `🆔 Task ID : ` +
        `\`${task.task_id}\`\n\n` +

        `👤 UID : ` +
        `\`${task.uid}\`\n\n` +

        `📌 Statut : *PENDING*\n\n` +

        `💵 Reward prévu : ` +
        `*${TASK_REWARD_EUR.toFixed(2)} €*\n\n` +

        `🔎 Votre soumission doit maintenant être vérifiée par un administrateur.\n\n` +

        `⚠️ Aucun montant n'a encore été crédité.\n\n` +

        `Vous recevrez automatiquement une notification Telegram après la décision.`,

        Markup.inlineKeyboard([

          [
            Markup.button.callback(
              '📋 Mes tâches',
              'action_my_tasks'
            )
          ],

          [
            Markup.button.callback(
              '💰 Mon solde',
              'action_check_balance'
            )
          ],

          [
            Markup.button.callback(
              '🚀 Nouvelle tâche',
              'task_facebook'
            )
          ]

        ])
      );

      console.log(
        `[TASK PENDING] ${task.task_id} user=${userId}`
      );

    } catch (error) {

      try {
        await client.query(
          'ROLLBACK'
        );
      } catch (_) {}

      console.error(
        '[TASK INSERT ERROR]',
        error
      );

      await ctx.reply(
        `❌ Erreur lors de l'enregistrement.\n\nAucun reward n'a été crédité.`,
        {
          ...MAIN_REPLY_KEYBOARD
        }
      );

    } finally {

      client.release();
    }
  }
);

// ============================================================
// 28. MY TASKS
// ============================================================

bot.action(
  'action_my_tasks',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(
        ctx.from?.id || 'unknown'
      );

    const result =
      await dbQuery(
        `
        SELECT

          task_id,

          task_type,

          status,

          validation_status,

          validation_reason,

          uid,

          reward_usd,

          reward_paid,

          created_at,

          validated_at

        FROM tasks

        WHERE telegram_user_id = $1

        ORDER BY created_at DESC

        LIMIT 15
        `,
        [userId]
      );

    if (
      result.rows.length === 0
    ) {

      return renderScreen(

        ctx,

        `📋 *Mes tâches*\n\n` +
        `Aucune tâche enregistrée.`,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🚀 Nouvelle tâche',
              'task_facebook'
            )
          ]
        ])
      );
    }

    let message =
      `📋 *Mes dernières tâches*\n\n`;

    result.rows.forEach(
      task => {

        const status =
          task.validation_status ||
          task.status ||
          'pending';

        const icon =
          status === 'validated'
            ? '✅'
            : status === 'rejected'
              ? '❌'
              : '⏳';

        message +=
          `${icon} \`${task.task_id}\`\n` +

          `UID: \`${task.uid || '-'}\`\n` +

          `Statut: *${status.toUpperCase()}*\n` +

          `Reward: \`${Number(task.reward_usd || 0).toFixed(2)} €\`\n`;

        if (
          task.validation_reason
        ) {

          message +=
            `Motif: ${task.validation_reason}\n`;
        }

        message += '\n';
      }
    );

    await renderScreen(

      ctx,

      message,

      Markup.inlineKeyboard([

        [
          Markup.button.callback(
            '🔄 Actualiser',
            'action_my_tasks'
          )
        ],

        [
          Markup.button.callback(
            '🚀 Nouvelle tâche',
            'task_facebook'
          )
        ],

        [
          Markup.button.callback(
            '💰 Mon solde',
            'action_check_balance'
          )
        ]

      ])
    );
  }
);

// ============================================================
// 29. ADMIN PANEL
// ============================================================

bot.command(
  'admin',
  async ctx => {

    const adminId =
      String(
        ctx.from?.id || ''
      );

    if (
      !isAdmin(adminId)
    ) {

      return ctx.reply(
        '⛔ Accès administrateur refusé.'
      );
    }

    const result =
      await dbQuery(
        `
        SELECT COUNT(*)::int AS count

        FROM tasks

        WHERE validation_status =
          'pending'
        `
      );

    const count =
      Number(
        result.rows[0]?.count || 0
      );

    await ctx.reply(

      `🛡️ *ADMIN PANEL*\n\n` +

      `⏳ Tâches PENDING : *${count}*\n\n` +

      `Sélectionnez une action :`,

      {
        parse_mode: 'Markdown',

        ...Markup.inlineKeyboard([

          [
            Markup.button.callback(
              '⏳ Voir PENDING',
              'admin_pending'
            )
          ],

          [
            Markup.button.callback(
              '🔄 Actualiser',
              'admin_panel'
            )
          ]

        ])
      }
    );
  }
);

// ============================================================
// ADMIN PANEL CALLBACK
// ============================================================

bot.action(
  'admin_panel',
  async ctx => {

    await ctx.answerCbQuery();

    const adminId =
      String(
        ctx.from?.id || ''
      );

    if (
      !isAdmin(adminId)
    ) {

      return renderScreen(
        ctx,
        '⛔ Accès refusé.'
      );
    }

    const result =
      await dbQuery(
        `
        SELECT COUNT(*)::int AS count

        FROM tasks

        WHERE validation_status =
          'pending'
        `
      );

    const count =
      Number(
        result.rows[0]?.count || 0
      );

    await renderScreen(

      ctx,

      `🛡️ *ADMIN PANEL*\n\n` +

      `⏳ Tâches PENDING : *${count}*`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '⏳ Voir PENDING',
            'admin_pending'
          )
        ]
      ])
    );
  }
);

// ============================================================
// 30. ADMIN PENDING
// ============================================================

bot.command(
  'pending',
  async ctx => {

    const adminId =
      String(
        ctx.from?.id || ''
      );

    if (
      !isAdmin(adminId)
    ) {

      return ctx.reply(
        '⛔ Accès refusé.'
      );
    }

    return showAdminPending(
      ctx
    );
  }
);

bot.action(
  'admin_pending',
  async ctx => {

    await ctx.answerCbQuery();

    const adminId =
      String(
        ctx.from?.id || ''
      );

    if (
      !isAdmin(adminId)
    ) {

      return renderScreen(
        ctx,
        '⛔ Accès refusé.'
      );
    }

    return showAdminPending(
      ctx
    );
  }
);

async function showAdminPending(
  ctx
) {

  const result =
    await dbQuery(
      `
      SELECT

        task_id,

        telegram_user_id,

        telegram_username,

        task_type,

        uid,

        first_name,

        last_name,

        reward_usd,

        status,

        validation_status,

        created_at

      FROM tasks

      WHERE validation_status =
        'pending'

      ORDER BY created_at ASC

      LIMIT 30
      `
    );

  if (
    result.rows.length === 0
  ) {

    return renderScreen(

      ctx,

      `⏳ *PENDING*\n\n` +
      `Aucune tâche en attente.`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🔄 Actualiser',
            'admin_pending'
          )
        ]
      ])
    );
  }

  let message =
    `🛡️ *TÂCHES PENDING*\n\n`;

  const buttons = [];

  result.rows.forEach(
    task => {

      message +=

        `⏳ \`${task.task_id}\`\n` +

        `👤 User: \`${task.telegram_user_id}\`\n` +

        `🆔 UID: \`${task.uid || '-'}\`\n` +

        `💵 Reward: \`${Number(task.reward_usd || 0).toFixed(2)} €\`\n\n`;

      buttons.push([
        Markup.button.callback(
          `🔎 ${task.task_id}`,
          `admin_view:${task.task_id}`
        )
      ]);
    }
  );

  buttons.push([
    Markup.button.callback(
      '🔄 Actualiser',
      'admin_pending'
    )
  ]);

  return renderScreen(

    ctx,

    message,

    Markup.inlineKeyboard(
      buttons
    )
  );
}

// ============================================================
// 31. ADMIN VIEW TASK
// ============================================================

bot.action(
  /^admin_view:(.+)$/,
  async ctx => {

    await ctx.answerCbQuery();

    const adminId =
      String(
        ctx.from?.id || ''
      );

    if (
      !isAdmin(adminId)
    ) {

      return renderScreen(
        ctx,
        '⛔ Accès refusé.'
      );
    }

    const taskId =
      ctx.match[1];

    const result =
      await dbQuery(
        `
        SELECT *

        FROM tasks

        WHERE task_id = $1

        LIMIT 1
        `,
        [taskId]
      );

    if (
      result.rows.length === 0
    ) {

      return renderScreen(
        ctx,
        `❌ Tâche introuvable.`
      );
    }

    const task =
      result.rows[0];

    await renderScreen(

      ctx,

      `🔎 *DÉTAIL TÂCHE*\n\n` +

      `🆔 Task ID : \`${task.task_id}\`\n` +

      `👤 Telegram ID : \`${task.telegram_user_id}\`\n` +

      `🆔 UID : \`${task.uid || '-'}\`\n` +

      `👤 Nom : ${task.first_name || '-'} ${task.last_name || ''}\n` +

      `📋 Type : ${task.task_type || '-'}\n` +

      `📌 Statut : *${task.validation_status || task.status}*\n` +

      `💵 Reward : *${Number(task.reward_usd || 0).toFixed(2)} €*\n` +

      `📅 Créé : ${new Date(task.created_at).toLocaleString('fr-FR')}\n\n` +

      `Choisissez la décision :`,

      Markup.inlineKeyboard([

        [
          Markup.button.callback(
            '✅ VALIDER',
            `admin_validate:${task.task_id}`
          )
        ],

        [
          Markup.button.callback(
            '❌ REJETER',
            `admin_reject:${task.task_id}`
          )
        ],

        [
          Markup.button.callback(
            '🔙 Retour PENDING',
            'admin_pending'
          )
        ]

      ])
    );
  }
);

// ============================================================
// 32. ADMIN VALIDATE
// ============================================================

bot.action(
  /^admin_validate:(.+)$/,
  async ctx => {

    await ctx.answerCbQuery();

    const adminTelegramId =
      String(
        ctx.from?.id || ''
      );

    if (
      !isAdmin(adminTelegramId)
    ) {

      return renderScreen(
        ctx,
        '⛔ Accès refusé.'
      );
    }

    const taskId =
      ctx.match[1];

    const client =
      await pool.connect();

    try {

      await client.query(
        'BEGIN'
      );

      const taskResult =
        await client.query(
          `
          SELECT *

          FROM tasks

          WHERE task_id = $1

          FOR UPDATE
          `,
          [taskId]
        );

      if (
        taskResult.rows.length === 0
      ) {

        await client.query(
          'ROLLBACK'
        );

        return renderScreen(
          ctx,
          '❌ Tâche introuvable.'
        );
      }

      const task =
        taskResult.rows[0];

      // ------------------------------------------------------
      // DOUBLE VALIDATION PROTECTION
      // ------------------------------------------------------

      if (
        task.validation_status ===
          'validated' ||

        task.reward_paid === true
      ) {

        await client.query(
          'ROLLBACK'
        );

        return renderScreen(

          ctx,

          `⚠️ Cette tâche a déjà été validée.`,

          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '🔙 PENDING',
                'admin_pending'
              )
            ]
          ])
        );
      }

      // ------------------------------------------------------
      // GET ADMIN DATABASE USER ID
      // ------------------------------------------------------

      const adminUserResult =
        await client.query(
          `
          SELECT id

          FROM users

          WHERE telegram_user_id = $1

          LIMIT 1
          `,
          [adminTelegramId]
        );

      let validatorDbId =
        null;

      if (
        adminUserResult.rows.length > 0
      ) {

        validatorDbId =
          adminUserResult.rows[0].id;
      }

      // ------------------------------------------------------
      // UPDATE TASK
      // ------------------------------------------------------

      const now =
        new Date();

      const reward =
        Number(
          task.reward_usd ||
          TASK_REWARD_EUR
        );

      const updatedTask =
        await client.query(
          `
          UPDATE tasks

          SET

            status =
              'validated',

            validation_status =
              'validated',

            validation_reason =
              NULL,

            validated_at =
              NOW(),

            validated_by =
              $2,

            reward_paid =
              TRUE,

            reward_paid_at =
              NOW(),

            completed_at =
              NOW(),

            account_created =
              account_created,

            account_created_at =
              account_created_at

          WHERE task_id = $1

          RETURNING *
          `,
          [
            taskId,
            validatorDbId
          ]
        );

      // ------------------------------------------------------
      // GET WORKER
      // ------------------------------------------------------

      const workerResult =
        await client.query(
          `
          SELECT *

          FROM users

          WHERE telegram_user_id = $1

          FOR UPDATE
          `,
          [
            task.telegram_user_id
          ]
        );

      if (
        workerResult.rows.length === 0
      ) {

        throw new Error(
          'Worker introuvable'
        );
      }

      const worker =
        workerResult.rows[0];

      // ------------------------------------------------------
      // ENSURE WALLET
      // ------------------------------------------------------

      const walletResult =
        await client.query(
          `
          SELECT *

          FROM wallets

          WHERE user_id = $1

          FOR UPDATE
          `,
          [worker.id]
        );

      let balanceBefore =
        0;

      if (
        walletResult.rows.length === 0
      ) {

        await client.query(
          `
          INSERT INTO wallets (
            user_id,
            balance,
            total_earned,
            total_withdrawn
          )

          VALUES (
            $1,
            0,
            0,
            0
          )
          `,
          [worker.id]
        );

      } else {

        balanceBefore =
          Number(
            walletResult.rows[0].balance || 0
          );
      }

      const balanceAfter =
        balanceBefore +
        reward;

      // ------------------------------------------------------
      // CREDIT REWARD
      // ------------------------------------------------------

      await client.query(
        `
        UPDATE wallets

        SET

          balance =
            $2,

          total_earned =
            total_earned + $3,

          updated_at =
            NOW()

        WHERE user_id = $1
        `,
        [
          worker.id,
          balanceAfter,
          reward
        ]
      );

      // ------------------------------------------------------
      // TRANSACTION
      // ------------------------------------------------------

      await client.query(
        `
        INSERT INTO transactions (

          user_id,

          task_id,

          type,

          amount,

          balance_before,

          balance_after,

          description

        )

        VALUES (

          $1,
          $2,
          'task_reward',
          $3,
          $4,
          $5,
          $6

        )
        `,
        [

          worker.id,

          taskId,

          reward,

          balanceBefore,

          balanceAfter,

          `Reward tâche validée ${taskId}`
        ]
      );

      // ------------------------------------------------------
      // VALIDATION RECORD
      // ------------------------------------------------------

      const validationResult =
        await client.query(
          `
          INSERT INTO task_validations (

            task_id,

            validator_id,

            status,

            reason,

            validation_data,

            validated_at

          )

          VALUES (

            $1,
            $2,
            'validated',
            NULL,
            $3::jsonb,
            NOW()

          )

          RETURNING id
          `,
          [

            taskId,

            validatorDbId,

            JSON.stringify({
              source: 'telegram_admin',
              adminTelegramId,
              reward,
              validatedAt:
                now.toISOString()
            })
          ]
        );

      const validationId =
        validationResult.rows[0]?.id;

      // ------------------------------------------------------
      // VALIDATION REPORT
      // ------------------------------------------------------

      await client.query(
        `
        INSERT INTO validation_reports (

          task_id,

          validation_id,

          result,

          checks,

          notes

        )

        VALUES (

          $1,
          $2,
          'validated',
          $3::jsonb,
          $4

        )
        `,
        [

          taskId,

          validationId,

          JSON.stringify({
            adminValidated: true
          }),

          'Validation effectuée depuis Telegram Admin.'
        ]
      );

      // ------------------------------------------------------
      // REFERRAL COMMISSION
      // ------------------------------------------------------

      if (
        worker.referral_by &&
        worker.referral_by !==
          worker.telegram_user_id
      ) {

        const referrerResult =
          await client.query(
            `
            SELECT *

            FROM users

            WHERE telegram_user_id = $1

            FOR UPDATE
            `,
            [
              worker.referral_by
            ]
          );

        if (
          referrerResult.rows.length > 0
        ) {

          const referrer =
            referrerResult.rows[0];

          let refWalletResult =
            await client.query(
              `
              SELECT *

              FROM wallets

              WHERE user_id = $1

              FOR UPDATE
              `,
              [referrer.id]
            );

          if (
            refWalletResult.rows.length === 0
          ) {

            await client.query(
              `
              INSERT INTO wallets (
                user_id
              )

              VALUES ($1)
              `,
              [referrer.id]
            );

            refWalletResult =
              await client.query(
                `
                SELECT *

                FROM wallets

                WHERE user_id = $1

                FOR UPDATE
                `,
                [referrer.id]
              );
          }

          const referralBefore =
            Number(
              refWalletResult.rows[0].balance ||
              0
            );

          const referralAfter =
            referralBefore +
            REFERRAL_COMMISSION_EUR;

          await client.query(
            `
            UPDATE wallets

            SET

              balance =
                $2,

              total_earned =
                total_earned + $3,

              updated_at =
                NOW()

            WHERE user_id = $1
            `,
            [
              referrer.id,
              referralAfter,
              REFERRAL_COMMISSION_EUR
            ]
          );

          await client.query(
            `
            UPDATE users

            SET

              referral_earnings =
                referral_earnings + $2,

              updated_at =
                NOW()

            WHERE id = $1
            `,
            [
              referrer.id,
              REFERRAL_COMMISSION_EUR
            ]
          );

          await client.query(
            `
            INSERT INTO transactions (

              user_id,

              task_id,

              type,

              amount,

              balance_before,

              balance_after,

              description

            )

            VALUES (

              $1,
              $2,
              'referral_commission',
              $3,
              $4,
              $5,
              $6

            )
            `,
            [

              referrer.id,

              taskId,

              REFERRAL_COMMISSION_EUR,

              referralBefore,

              referralAfter,

              `Commission parrainage pour ${taskId}`
            ]
          );
        }
      }

      await client.query(
        'COMMIT'
      );

      // ------------------------------------------------------
      // GOOGLE SHEETS UPDATE
      // ------------------------------------------------------

      await syncToGoogleSheets({

        syncAction:
          'update_validation',

        id:
          taskId,

        uid:
          task.uid,

        firstName:
          task.first_name,

        lastName:
          task.last_name,

        telegramUserId:
          task.telegram_user_id,

        status:
          'validated',

        validation_status:
          'validated',

        validation_reason:
          null,

        validated_at:
          now.toISOString(),

        validated_by:
          adminTelegramId,

        reward_amount:
          reward,

        reward_paid:
          true,

        reward_paid_at:
          now.toISOString(),

        account_created:
          Boolean(
            task.account_created
          ),

        account_created_at:
          task.account_created_at,

        taskType:
          task.task_type,

        notes:
          `Tâche validée par administrateur.`
      });

      // ------------------------------------------------------
      // WORKER NOTIFICATION
      // ------------------------------------------------------

      try {

        await bot.telegram.sendMessage(

          task.telegram_user_id,

          `✅ *TÂCHE VALIDÉE*\n\n` +

          `🆔 Task ID : \`${taskId}\`\n` +

          `📌 Statut : *VALIDATED*\n` +

          `💰 Reward crédité : *${reward.toFixed(2)} €*\n\n` +

          `Votre solde a été mis à jour.`,

          {
            parse_mode: 'Markdown'
          }
        );

      } catch (notificationError) {

        console.warn(
          '[Telegram Notification]',
          notificationError.message
        );
      }

      await renderScreen(

        ctx,

        `✅ *TÂCHE VALIDÉE*\n\n` +

        `🆔 \`${taskId}\`\n` +

        `💰 Reward : *${reward.toFixed(2)} €*\n\n` +

        `Le reward a été crédité au worker.`,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '⏳ PENDING',
              'admin_pending'
            )
          ],

          [
            Markup.button.callback(
              '🛡️ Admin',
              'admin_panel'
            )
          ]
        ])
      );

    } catch (error) {

      try {
        await client.query(
          'ROLLBACK'
        );
      } catch (_) {}

      console.error(
        '[ADMIN VALIDATE ERROR]',
        error
      );

      await renderScreen(

        ctx,

        `❌ *Erreur de validation*\n\n` +
        `${error.message}`,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🔙 Retour',
              'admin_pending'
            )
          ]
        ])
      );

    } finally {

      client.release();
    }
  }
);

// ============================================================
// 33. ADMIN REJECT
// ============================================================

bot.action(
  /^admin_reject:(.+)$/,
  async ctx => {

    await ctx.answerCbQuery();

    const adminTelegramId =
      String(
        ctx.from?.id || ''
      );

    if (
      !isAdmin(adminTelegramId)
    ) {

      return renderScreen(
        ctx,
        '⛔ Accès refusé.'
      );
    }

    const taskId =
      ctx.match[1];

    const client =
      await pool.connect();

    try {

      await client.query(
        'BEGIN'
      );

      const taskResult =
        await client.query(
          `
          SELECT *

          FROM tasks

          WHERE task_id = $1

          FOR UPDATE
          `,
          [taskId]
        );

      if (
        taskResult.rows.length === 0
      ) {

        await client.query(
          'ROLLBACK'
        );

        return renderScreen(
          ctx,
          '❌ Tâche introuvable.'
        );
      }

      const task =
        taskResult.rows[0];

      if (
        task.validation_status ===
          'validated' ||

        task.reward_paid === true
      ) {

        await client.query(
          'ROLLBACK'
        );

        return renderScreen(
          ctx,
          `⚠️ Cette tâche est déjà validée.`
        );
      }

      const adminResult =
        await client.query(
          `
          SELECT id

          FROM users

          WHERE telegram_user_id = $1

          LIMIT 1
          `,
          [adminTelegramId]
        );

      const validatorId =
        adminResult.rows[0]?.id ||
        null;

      const reason =
        'Soumission rejetée par l’administration après vérification.';

      const now =
        new Date();

      const validationResult =
        await client.query(
          `
          INSERT INTO task_validations (

            task_id,

            validator_id,

            status,

            reason,

            validation_data,

            validated_at

          )

          VALUES (

            $1,
            $2,
            'rejected',
            $3,
            $4::jsonb,
            NOW()

          )

          RETURNING id
          `,
          [

            taskId,

            validatorId,

            reason,

            JSON.stringify({
              source: 'telegram_admin',
              adminTelegramId,
              rejectedAt:
                now.toISOString()
            })
          ]
        );

      const validationId =
        validationResult.rows[0]?.id;

      await client.query(
        `
        UPDATE tasks

        SET

          status =
            'rejected',

          validation_status =
            'rejected',

          validation_reason =
            $2,

          validated_at =
            NOW(),

          validated_by =
            $3,

          reward_paid =
            FALSE,

          reward_paid_at =
            NULL

        WHERE task_id = $1
        `,
        [

          taskId,

          reason,

          validatorId
        ]
      );

      await client.query(
        `
        INSERT INTO validation_reports (

          task_id,

          validation_id,

          result,

          checks,

          notes

        )

        VALUES (

          $1,
          $2,
          'rejected',
          $3::jsonb,
          $4

        )
        `,
        [

          taskId,

          validationId,

          JSON.stringify({
            adminValidated: false
          }),

          reason
        ]
      );

      await client.query(
        'COMMIT'
      );

      // ------------------------------------------------------
      // GOOGLE SHEETS
      // ------------------------------------------------------

      await syncToGoogleSheets({

        syncAction:
          'update_validation',

        id:
          taskId,

        uid:
          task.uid,

        firstName:
          task.first_name,

        lastName:
          task.last_name,

        telegramUserId:
          task.telegram_user_id,

        status:
          'rejected',

        validation_status:
          'rejected',

        validation_reason:
          reason,

        validated_at:
          now.toISOString(),

        validated_by:
          adminTelegramId,

        reward_amount:
          Number(
            task.reward_usd ||
            TASK_REWARD_EUR
          ),

        reward_paid:
          false,

        reward_paid_at:
          null,

        account_created:
          false,

        taskType:
          task.task_type,

        notes:
          `Tâche rejetée par administrateur.`
      });

      // ------------------------------------------------------
      // WORKER NOTIFICATION
      // ------------------------------------------------------

      try {

        await bot.telegram.sendMessage(

          task.telegram_user_id,

          `❌ *TÂCHE REJETÉE*\n\n` +

          `🆔 Task ID : \`${taskId}\`\n` +

          `📌 Statut : *REJECTED*\n\n` +

          `📝 Motif :\n` +

          `${reason}\n\n` +

          `💰 Aucun reward n'a été crédité.`,

          {
            parse_mode: 'Markdown'
          }
        );

      } catch (notificationError) {

        console.warn(
          '[Telegram Notification]',
          notificationError.message
        );
      }

      await renderScreen(

        ctx,

        `❌ *TÂCHE REJETÉE*\n\n` +

        `🆔 \`${taskId}\`\n\n` +

        `📝 ${reason}\n\n` +

        `💰 Aucun reward crédité.`,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '⏳ PENDING',
              'admin_pending'
            )
          ]
        ])
      );

    } catch (error) {

      try {
        await client.query(
          'ROLLBACK'
        );
      } catch (_) {}

      console.error(
        '[ADMIN REJECT ERROR]',
        error
      );

      await renderScreen(

        ctx,

        `❌ *Erreur lors du rejet*\n\n` +
        `${error.message}`,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🔙 Retour',
              'admin_pending'
            )
          ]
        ])
      );

    } finally {

      client.release();
    }
  }
);

// ============================================================
// 34. BALANCE CALLBACK
// ============================================================

bot.action(
  'action_check_balance',
  async ctx => {

    await ctx.answerCbQuery();

    return handleBalanceMenu(
      ctx
    );
  }
);

// ============================================================
// 35. WITHDRAW CALLBACKS
// ============================================================

bot.action(
  'action_request_withdrawal',
  async ctx => {

    await ctx.answerCbQuery();

    return handleWithdrawalMenu(
      ctx
    );
  }
);

bot.action(
  'withdraw_mobile_money',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `📱 *Retrait Mobile Money*\n\n` +

      `Solde disponible selon votre compte.\n\n` +

      `Contactez le support officiel pour transmettre votre demande.`,

      Markup.inlineKeyboard([
        [
          Markup.button.url(
            '💬 Support',
            'https://t.me/TaskifySupport'
          )
        ],

        [
          Markup.button.callback(
            '🔙 Retour',
            'action_request_withdrawal'
          )
        ]
      ])
    );
  }
);

bot.action(
  'withdraw_crypto',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `🪙 *Retrait USDT*\n\n` +

      `Contactez le support officiel pour votre demande de retrait.`,

      Markup.inlineKeyboard([
        [
          Markup.button.url(
            '💬 Support',
            'https://t.me/TaskifySupport'
          )
        ],

        [
          Markup.button.callback(
            '🔙 Retour',
            'action_request_withdrawal'
          )
        ]
      ])
    );
  }
);

bot.action(
  'withdraw_bank',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `💳 *Virement Bancaire*\n\n` +

      `Contactez le support officiel pour votre demande.`,

      Markup.inlineKeyboard([
        [
          Markup.button.url(
            '💬 Support',
            'https://t.me/TaskifySupport'
          )
        ],

        [
          Markup.button.callback(
            '🔙 Retour',
            'action_request_withdrawal'
          )
        ]
      ])
    );
  }
);

// ============================================================
// 36. FAQ
// ============================================================

bot.action(
  'action_faq',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `❓ *FAQ*\n\n` +

      `*Q1 : Quand ma tâche est-elle validée ?*\n\n` +

      `R : Après soumission, la tâche passe d'abord en *PENDING*. Un administrateur effectue ensuite la vérification.\n\n` +

      `*Q2 : Quand suis-je payé ?*\n\n` +

      `R : Le reward est crédité uniquement lorsque la tâche passe en *VALIDATED*.\n\n` +

      `*Q3 : Que se passe-t-il si la tâche est rejetée ?*\n\n` +

      `R : La tâche passe en *REJECTED* et aucun reward n'est crédité.`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🚀 Nouvelle tâche',
            'task_facebook'
          )
        ],

        [
          Markup.button.callback(
            '📞 Support',
            'action_contact_support'
          )
        ]
      ])
    );
  }
);

// ============================================================
// 37. CONTACT SUPPORT
// ============================================================

bot.action(
  'action_contact_support',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `📞 *Support ${PLATFORM_NAME}*\n\n` +

      `Contact : @TaskifySupport`,

      Markup.inlineKeyboard([
        [
          Markup.button.url(
            '💬 Ouvrir Support',
            'https://t.me/TaskifySupport'
          )
        ]
      ])
    );
  }
);

// ============================================================
// 38. HEALTH CHECK
// ============================================================

const server =
  http.createServer(
    async (req, res) => {

      if (
        req.url === '/' ||
        req.url === '/health'
      ) {

        let database =
          false;

        try {

          await dbQuery(
            'SELECT 1'
          );

          database = true;

        } catch (error) {

          database = false;
        }

        res.writeHead(
          database ? 200 : 503,
          {
            'Content-Type':
              'application/json'
          }
        );

        res.end(
          JSON.stringify({

            status:
              database
                ? 'ok'
                : 'degraded',

            bot:
              `${PLATFORM_NAME} (@TaskifyProBot)`,

            database,

            googleSheets:
              Boolean(
                GOOGLE_SHEET_WEBHOOK_URL
              ),

            uptime:
              process.uptime(),

            timestamp:
              new Date().toISOString()

          })
        );

        return;
      }

      res.writeHead(
        404
      );

      res.end();
    }
  );

// ============================================================
// 39. START APPLICATION
// ============================================================

async function startApplication() {

  try {

    await initializeBotDatabase();

    await dbQuery(
      'SELECT NOW()'
    );

    console.log(
      '✅ PostgreSQL connection OK'
    );

    server.listen(
      PORT,
      () => {

        console.log(
          `[HTTP Server] Health check port ${PORT}`
        );
      }
    );

    await bot.launch();

    console.log(
      '===================================================='
    );

    console.log(
      `🤖 [${PLATFORM_NAME}] Telegram Bot démarré`
    );

    console.log(
      `🚀 Mode : Polling`
    );

    console.log(
      `🗄️ Database : PostgreSQL ✅`
    );

    console.log(
      `📊 Google Sheets : ${
        GOOGLE_SHEET_WEBHOOK_URL
          ? 'Configuré ✅'
          : 'Non configuré ⚠️'
      }`
    );

    console.log(
      `🛡️ Admin IDs : ${
        ADMIN_TELEGRAM_IDS.length
          ? ADMIN_TELEGRAM_IDS.length
          : 0
      }`
    );

    console.log(
      '===================================================='
    );

  } catch (error) {

    console.error(
      '❌ Startup error:',
      error
    );

    process.exit(1);
  }
}

startApplication();

// ============================================================
// 40. GRACEFUL SHUTDOWN
// ============================================================

process.once(
  'SIGINT',
  async () => {

    console.log(
      'Arrêt du bot...'
    );

    bot.stop(
      'SIGINT'
    );

    server.close();

    await pool.end();

    process.exit(0);
  }
);

process.once(
  'SIGTERM',
  async () => {

    console.log(
      'Arrêt du bot...'
    );

    bot.stop(
      'SIGTERM'
    );

    server.close();

    await pool.end();

    process.exit(0);
  }
);

// ============================================================
// 41. GLOBAL ERROR HANDLER
// ============================================================

bot.catch(
  (error, ctx) => {

    console.error(
      `[Telegraf Error] user=${ctx.from?.id}`,
      error
    );

    ctx.reply(
      `⚠️ Une erreur inattendue est survenue.\n\n` +
      `Veuillez utiliser /start pour recommencer.`,
      {
        ...MAIN_REPLY_KEYBOARD
      }
    ).catch(
      () => {}
    );
  }
);
