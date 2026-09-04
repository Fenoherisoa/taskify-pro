/**
 * Taskify Pro - Telegram Bot (@TaskifyProBot)
 *
 * Workflow:
 *   SUBMISSION
 *       ↓
 *   PENDING
 *       ↓
 *   ADMIN VALIDATION
 *       ├── VALIDATED → reward credited
 *       └── REJECTED  → no reward
 *
 * Google Sheets:
 *   New task       → action: insert_task
 *   Admin decision → action: update_validation
 *
 * Environment:
 *   TELEGRAM_BOT_TOKEN
 *   GOOGLE_SHEET_WEBHOOK_URL
 *   ADMIN_TELEGRAM_IDS=123456789,987654321
 *   DEFAULT_BOT_PASSWORD
 *   PLATFORM_NAME
 *   PORT
 */

require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const http = require('http');

// ====================================================
// 1. CONFIGURATION
// ====================================================

const WORKER_WEB_APP_URL =
  'https://taskify-pro-bf2q.onrender.com';

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN;

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

// ====================================================
// ADMIN TELEGRAM IDS
// ====================================================

const ADMIN_TELEGRAM_IDS = String(
  process.env.ADMIN_TELEGRAM_IDS || ''
)
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

function isAdmin(userId) {
  return ADMIN_TELEGRAM_IDS.includes(String(userId));
}

// ====================================================
// TOKEN CHECK
// ====================================================

if (!TELEGRAM_BOT_TOKEN) {
  console.error(
    '❌ CRITICAL ERROR: TELEGRAM_BOT_TOKEN is missing.'
  );

  process.exit(1);
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// ====================================================
// 2. KEYBOARDS
// ====================================================

const WORKER_MAIN_KEYBOARD = Markup.keyboard([
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

// ====================================================
// 3. DATA
// ====================================================

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

// ====================================================
// RANDOM IDENTITY
// ====================================================

function getRandomIdentity() {
  const firstName =
    FIRST_NAMES[
      Math.floor(
        Math.random() * FIRST_NAMES.length
      )
    ];

  const lastName =
    LAST_NAMES[
      Math.floor(
        Math.random() * LAST_NAMES.length
      )
    ];

  return {
    firstName,
    lastName
  };
}

// ====================================================
// MEMORY STORAGE
// ====================================================

const userSessions = {};
const userLedger = {};

// ====================================================
// USER DATA
// ====================================================

function getUserData(
  userId,
  username,
  firstName
) {
  if (!userLedger[userId]) {
    userLedger[userId] = {
      userId: String(userId),

      username:
        username ||
        'utilisateur',

      firstName:
        firstName ||
        'Opérateur',

      tasksCompleted: 0,

      balance: 0.00,

      pendingBalance: 0.00,

      pendingTasks: [],

      referralsCount: 0,

      referralEarnings: 0.00,

      referredBy: null,

      language: 'fr',

      joinedAt:
        new Date().toISOString()
    };
  }

  const user = userLedger[userId];

  if (!Array.isArray(user.pendingTasks)) {
    user.pendingTasks = [];
  }

  return user;
}

// ====================================================
// FIND PENDING TASK
// ====================================================

function findPendingTask(taskId) {
  const wantedId = String(taskId);

  for (
    const userId of Object.keys(userLedger)
  ) {
    const user = userLedger[userId];

    if (
      !Array.isArray(user.pendingTasks)
    ) {
      continue;
    }

    const taskIndex =
      user.pendingTasks.findIndex(
        task =>
          String(task.id) === wantedId
      );

    if (taskIndex !== -1) {
      return {
        userId,
        user,
        task: user.pendingTasks[taskIndex],
        taskIndex
      };
    }
  }

  return null;
}

// ====================================================
// 4. TRANSLATIONS
// ====================================================

const TRANSLATIONS = {

  fr: {

    welcome:
      `👋 *Bienvenue sur ${PLATFORM_NAME} (@TaskifyProBot) !*\n\n` +
      `Plateforme automatisée de gestion et soumission de tâches rémunérées.\n\n` +
      `Utilisez le menu ci-dessous pour démarrer vos tâches, suivre vos gains ou demander un retrait.\n\n` +
      `👉 Cliquez sur *📋 Tâches* pour débuter.`,

    choose_task:
      `📋 *Menu des Tâches Disponibles*\n\n` +
      `Sélectionnez une catégorie de tâche à effectuer :`,

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
      `🪩 *Sélection de la Langue*`,

    lang_selected:
      `✅ Langue configurée en **Français**.`
  },

  mg: {

    welcome:
      `👋 *Tongasoa eto amin'ny ${PLATFORM_NAME} (@TaskifyProBot) !*\n\n` +
      `Sehatra fanaovana asa sy fandefasana tâche mahazo vola.\n\n` +
      `Ampiasao ny bokotra eo ambany hanombohana ny asa, hijerena ny solde, na hangatahana retrait.\n\n` +
      `👉 Tsindrio ny *📋 Tâches* hanombohana.`,

    choose_task:
      `📋 *Safidy ny Asa Azo Atao*\n\n` +
      `Fidio ny sokajin'asa tianao hatao :`,

    balance_title:
      `💰 *Ny Solde sy ny Asanao*`,

    withdrawal_title:
      `🏦 *Fangatahana Retrait*`,

    support_title:
      `📞 *Fanampiana & Fifandraisana*`,

    referral_title:
      `👥 *Fandaharana Parrainage*`,

    leaderboard_title:
      `🏆 *Laharana Voalohany*`,

    lang_title:
      `🪩 *Fisafidianana Fiteny*`,

    lang_selected:
      `✅ Voafaritra amin'ny teny **Malagasy** ny bot.`
  },

  en: {

    welcome:
      `👋 *Welcome to ${PLATFORM_NAME} (@TaskifyProBot)!*\n\n` +
      `Automated task management and submission platform.\n\n` +
      `Use the menu below to start tasks, track your earnings or request withdrawals.\n\n` +
      `👉 Click *📋 Tâches* to begin.`,

    choose_task:
      `📋 *Available Tasks Menu*\n\n` +
      `Select a task category to proceed:`,

    balance_title:
      `💰 *Your Balance & Statistics*`,

    withdrawal_title:
      `🏦 *Withdrawal Request*`,

    support_title:
      `📞 *Support & Helpdesk*`,

    referral_title:
      `👥 *Referral Program*`,

    leaderboard_title:
      `🏆 *Top Operators Leaderboard*`,

    lang_title:
      `🪩 *Language Selection*`,

    lang_selected:
      `✅ Language updated to **English**.`
  }
};

// ====================================================
// 5. GOOGLE SHEETS SYNC
// ====================================================

async function syncToGoogleSheets(task) {

  if (
    !GOOGLE_SHEET_WEBHOOK_URL ||
    !GOOGLE_SHEET_WEBHOOK_URL.startsWith('http')
  ) {
    console.log(
      `[Google Sheets] Webhook non configuré. ` +
      `Task: ${task.id}`
    );

    return {
      success: false,
      reason: 'URL_NOT_CONFIGURED'
    };
  }

  const payload = {

    /*
     * NEW TASK:
     *   insert_task
     *
     * VALIDATION:
     *   update_validation
     */
    action:
      task.syncAction ||
      'insert_task',

    id:
      task.id ||
      `task-${Date.now()}`,

    timestamp:
      task.timestamp ||
      new Date().toISOString(),

    uid:
      task.uid || '',

    cookies:
      task.cookies || '',

    firstName:
      task.firstName || '',

    lastName:
      task.lastName || '',

    password:
      task.password || '',

    telegramUserId:
      String(
        task.telegramUserId || ''
      ),

    telegramUsername:
      task.telegramUsername ||
      'utilisateur',

    status:
      task.status ||
      'pending',

    validation_status:
      task.validation_status ||
      'pending',

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
      task.reward_paid_at ||
      null,

    validated_at:
      task.validated_at ||
      null,

    validated_by:
      task.validated_by ||
      null,

    validation_reason:
      task.validation_reason ||
      null,

    account_created:
      Boolean(
        task.account_created
      ),

    account_created_at:
      task.account_created_at ||
      null,

    notes:
      task.notes ||
      `Enregistré via ${PLATFORM_NAME}`,

    taskType:
      task.taskType ||
      'Facebook'
  };

  console.log(
    `[Google Sheets] 📡 action=${payload.action} ` +
    `task=${payload.id}`
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
            controller.signal,

          redirect:
            'follow'
        }
      );

    clearTimeout(timeoutId);

    const responseText =
      await response.text();

    const isOk =
      response.ok ||
      response.status < 400;

    if (isOk) {

      console.log(
        `[Google Sheets] ✅ ` +
        `Sync réussie: ${payload.id} ` +
        `HTTP=${response.status}`
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
      `[Google Sheets] ❌ HTTP ${response.status}: ` +
      responseText.slice(0, 300)
    );

    return {
      success: false,
      statusCode:
        response.status,
      body:
        responseText
    };

  } catch (error) {

    const errorMsg =
      error.name === 'AbortError'
        ? 'Timeout 15 secondes'
        : error.message;

    console.error(
      `[Google Sheets] ❌ ${errorMsg}`
    );

    return {
      success: false,
      error: errorMsg
    };
  }
}

// ====================================================
// 6. UI RENDER
// ====================================================

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

  } catch (err) {

    if (
      !err.message ||
      !err.message.includes(
        'message is not modified'
      )
    ) {
      console.warn(
        '[UI Render]',
        err.message
      );
    } else {
      return;
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

// ====================================================
// 7. /START
// ====================================================

bot.start(async ctx => {

  const userId =
    String(
      ctx.from?.id ||
      'unknown'
    );

  const userFirstName =
    ctx.from?.first_name ||
    'Opérateur';

  const username =
    ctx.from?.username ||
    '';

  const user =
    getUserData(
      userId,
      username,
      userFirstName
    );

  userSessions[userId] = {
    step: 'START'
  };

  const startPayload =
    ctx.message.text
      .split(' ')[1];

  if (
    startPayload &&
    startPayload.startsWith('ref_') &&
    !user.referredBy
  ) {

    const referrerId =
      startPayload
        .replace('ref_', '');

    if (
      referrerId !== userId
    ) {

      user.referredBy =
        referrerId;

      if (
        userLedger[referrerId]
      ) {

        userLedger[
          referrerId
        ].referralsCount += 1;
      }

      console.log(
        `[Referral] ${userId} → ${referrerId}`
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
});

// ====================================================
// 8. /HELP
// ====================================================

bot.help(async ctx => {

  await ctx.reply(

    `📌 *Guide d'utilisation - ${PLATFORM_NAME}*\n\n` +

    `1. Cliquez sur *📋 Tâches*.\n` +

    `2. Sélectionnez la tâche disponible.\n` +

    `3. Suivez les instructions affichées par le bot.\n` +

    `4. Envoyez les informations demandées pour votre soumission.\n\n` +

    `5. Votre tâche est d'abord enregistrée avec le statut *PENDING*.\n` +

    `6. Un administrateur vérifie ensuite votre soumission.\n` +

    `7. Si elle est validée, le statut devient *VALIDATED* et la récompense est créditée.\n` +

    `8. Si elle est rejetée, aucun reward n'est crédité.\n\n` +

    `ℹ️ Vous recevrez automatiquement une notification Telegram concernant la décision.`,

    {
      parse_mode: 'Markdown',

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🚀 Démarrer une tâche',
            'task_facebook'
          )
        ],

        [
          Markup.button.callback(
            '📞 Contacter le Support',
            'action_contact_support'
          )
        ]
      ])
    }
  );
});

// ====================================================
// 9. BALANCE MENU
// ====================================================

async function handleBalanceMenu(ctx) {

  const userId =
    String(
      ctx.from?.id ||
      'unknown'
    );

  const user =
    getUserData(
      userId,
      ctx.from?.username,
      ctx.from?.first_name
    );

  userSessions[userId] = {
    step: 'START'
  };

  const pendingTasks =
    Array.isArray(user.pendingTasks)
      ? user.pendingTasks.filter(
          task =>
            task.validation_status === 'pending' ||
            task.status === 'pending'
        )
      : [];

  const pendingAmount =
    pendingTasks.reduce(
      (total, task) =>
        total +
        Number(
          task.reward_amount || 0
        ),
      0
    );

  await ctx.reply(

    `💰 *Votre Solde & Activité*\n\n` +

    `👤 Utilisateur : *${user.firstName}*\n` +

    `🆔 ID : \`${user.userId}\`\n\n` +

    `💵 *Solde disponible :* ` +
    `\`${Number(user.balance || 0).toFixed(2)} €\`\n\n` +

    `⏳ *Tâches PENDING :* ` +
    `\`${pendingTasks.length}\`\n` +

    `💶 *Rewards en attente :* ` +
    `\`${pendingAmount.toFixed(2)} €\`\n\n` +

    `📊 *Tâches validées :* ` +
    `\`${Number(user.tasksCompleted || 0)}\`\n\n` +

    `👥 *Filleuls :* ` +
    `\`${Number(user.referralsCount || 0)}\`\n` +

    `💎 *Commissions :* ` +
    `\`${Number(user.referralEarnings || 0).toFixed(2)} €\`\n\n` +

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

// ====================================================
// 10. TASK MENU
// ====================================================

async function handleTasksMenu(ctx) {

  const userId =
    String(
      ctx.from?.id ||
      'unknown'
    );

  userSessions[userId] = {
    step: 'AUTH_CHOICE',
    taskType: 'Facebook'
  };

  await ctx.reply(

    `🌐 *Tâche : Facebook*\n\n` +

    `💵 Récompense par tâche validée : ` +
    `*${TASK_REWARD_EUR.toFixed(2)} €*\n\n` +

    `Choisissez la méthode disponible :`,

    {
      parse_mode: 'Markdown',

      ...MAIN_REPLY_KEYBOARD,

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🍪 Continuer',
            'auth_cookies'
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

// ====================================================
// 11. WITHDRAWAL MENU
// ====================================================

async function handleWithdrawalMenu(ctx) {

  const userId =
    String(
      ctx.from?.id ||
      'unknown'
    );

  const user =
    getUserData(
      userId,
      ctx.from?.username,
      ctx.from?.first_name
    );

  userSessions[userId] = {
    step: 'START'
  };

  const isEligible =
    Number(user.balance || 0) >=
    MIN_WITHDRAWAL_EUR;

  await ctx.reply(

    `🏦 *Demande de Retrait*\n\n` +

    `💵 Solde disponible : ` +
    `*${Number(user.balance || 0).toFixed(2)} €*\n` +

    `🎯 Minimum : ` +
    `*${MIN_WITHDRAWAL_EUR.toFixed(2)} €*\n\n` +

    (
      isEligible
        ? `🟢 *Vous êtes éligible au retrait.*`
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
            '💳 Virement bancaire',
            'withdraw_bank'
          )
        ]
      ])
    }
  );
}

// ====================================================
// 12. SUPPORT
// ====================================================

async function handleSupportMenu(ctx) {

  const userId =
    String(
      ctx.from?.id ||
      'unknown'
    );

  userSessions[userId] = {
    step: 'START'
  };

  await ctx.reply(

    `📞 *Support & Assistance*\n\n` +

    `Une question, un problème avec une tâche ou un paiement ?\n\n` +

    `👤 Support : @TaskifySupport\n` +

    `📢 Canal : @TaskifyAnnouncements\n\n` +

    `_Utilisez le bouton ci-dessous pour contacter le support._`,

    {
      parse_mode: 'Markdown',

      ...MAIN_REPLY_KEYBOARD,

      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            '💬 Ouvrir le Support',
            'https://t.me/TaskifySupport'
          )
        ],

        [
          Markup.button.callback(
            '❓ FAQ',
            'action_faq'
          )
        ]
      ])
    }
  );
}

// ====================================================
// 13. REFERRAL
// ====================================================

async function handleReferralMenu(ctx) {

  const userId =
    String(
      ctx.from?.id ||
      'unknown'
    );

  const user =
    getUserData(
      userId,
      ctx.from?.username,
      ctx.from?.first_name
    );

  userSessions[userId] = {
    step: 'START'
  };

  const botUsername =
    ctx.botInfo?.username ||
    'TaskifyProBot';

  const refLink =
    `https://t.me/${botUsername}?start=ref_${userId}`;

  await ctx.reply(

    `👥 *Programme de Parrainage*\n\n` +

    `💎 Commission par tâche validée d'un filleul : ` +
    `*+${REFERRAL_COMMISSION_EUR.toFixed(2)} €*\n\n` +

    `📊 Filleuls : ` +
    `\`${user.referralsCount}\`\n` +

    `💵 Commissions : ` +
    `\`${Number(user.referralEarnings || 0).toFixed(2)} €\`\n\n` +

    `🔗 *Votre lien :*\n` +
    `\`${refLink}\``,

    {
      parse_mode: 'Markdown',

      ...MAIN_REPLY_KEYBOARD,

      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            '📤 Partager mon lien',
            `https://t.me/share/url?url=${encodeURIComponent(refLink)}`
          )
        ]
      ])
    }
  );
}

// ====================================================
// 14. LEADERBOARD
// ====================================================

async function handleLeaderboardMenu(ctx) {

  const userId =
    String(
      ctx.from?.id ||
      'unknown'
    );

  const user =
    getUserData(
      userId,
      ctx.from?.username,
      ctx.from?.first_name
    );

  userSessions[userId] = {
    step: 'START'
  };

  await ctx.reply(

    `🏆 *Classement des Opérateurs*\n\n` +

    `1. 🥇 Opérateur #9482 — 428 tâches\n` +
    `2. 🥈 Opérateur #1092 — 391 tâches\n` +
    `3. 🥉 Opérateur #7401 — 315 tâches\n` +
    `4. ⭐ Opérateur #5892 — 280 tâches\n` +
    `5. ⭐ Opérateur #3419 — 204 tâches\n\n` +

    `━━━━━━━━━━━━━━━━━━\n` +

    `📍 Votre position : ` +
    `\`${user.tasksCompleted > 0 ? 'Top 15%' : 'Non classé'}\`\n` +

    `📊 Vos tâches validées : ` +
    `\`${user.tasksCompleted}\``,

    {
      parse_mode: 'Markdown',

      ...MAIN_REPLY_KEYBOARD,

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🚀 Faire une tâche',
            'task_facebook'
          )
        ]
      ])
    }
  );
}

// ====================================================
// 15. LANGUAGE
// ====================================================

async function handleLanguageMenu(ctx) {

  const userId =
    String(
      ctx.from?.id ||
      'unknown'
    );

  const user =
    getUserData(
      userId,
      ctx.from?.username,
      ctx.from?.first_name
    );

  userSessions[userId] = {
    step: 'START'
  };

  const currentLang =
    user.language === 'mg'
      ? '🇲🇬 Malagasy'
      : user.language === 'en'
        ? '🇬🇧 English'
        : '🇫🇷 Français';

  await ctx.reply(

    `🪩 *Sélection de la Langue*\n\n` +

    `Langue actuelle : *${currentLang}*\n\n` +

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

// ====================================================
// 16. BOT.HEARS
// ====================================================

bot.hears(
  [
    '💰 Solde',
    '💰 Solde / Gains',
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
    'Démarrer tâche',
    'Démarrer tâche Facebook',
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
    'Assistance',
    '/support'
  ],
  handleSupportMenu
);

bot.hears(
  [
    '👥 Parrainages',
    '👥 Parrainage',
    'Parrainages',
    'Parrainage',
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
    '🪩 Langues',
    'Langue',
    'langue',
    'Language',
    '/language',
    '/langue'
  ],
  handleLanguageMenu
);

// ====================================================
// 17. LANGUAGE CALLBACKS
// ====================================================

bot.action(
  'set_lang_fr',
  async ctx => {

    const userId =
      String(ctx.from.id);

    const user =
      getUserData(
        userId,
        ctx.from.username,
        ctx.from.first_name
      );

    user.language = 'fr';

    await ctx.answerCbQuery(
      'Français configuré !'
    );

    await renderScreen(
      ctx,
      '✅ Langue configurée en **Français**.',
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
);

bot.action(
  'set_lang_mg',
  async ctx => {

    const userId =
      String(ctx.from.id);

    const user =
      getUserData(
        userId,
        ctx.from.username,
        ctx.from.first_name
      );

    user.language = 'mg';

    await ctx.answerCbQuery(
      'Malagasy voafidy!'
    );

    await renderScreen(
      ctx,
      `✅ Voafaritra amin'ny teny **Malagasy** ny bot.`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📋 Hanao Asa',
            'task_facebook'
          )
        ],

        [
          Markup.button.callback(
            '💰 Hijery Solde',
            'action_check_balance'
          )
        ]
      ])
    );
  }
);

bot.action(
  'set_lang_en',
  async ctx => {

    const userId =
      String(ctx.from.id);

    const user =
      getUserData(
        userId,
        ctx.from.username,
        ctx.from.first_name
      );

    user.language = 'en';

    await ctx.answerCbQuery(
      'English configured!'
    );

    await renderScreen(
      ctx,
      '🌐 Language updated to **English**.',
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📋 Tasks',
            'task_facebook'
          )
        ],

        [
          Markup.button.callback(
            '💰 Balance',
            'action_check_balance'
          )
        ]
      ])
    );
  }
);

// ====================================================
// 18. TASK FACEBOOK
// ====================================================

bot.action(
  'task_facebook',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(ctx.from.id);

    userSessions[userId] = {
      step: 'AUTH_CHOICE',
      taskType: 'Facebook'
    };

    await renderScreen(

      ctx,

      `🌐 *Tâche : Facebook*\n\n` +

      `💵 Récompense : ` +
      `*${TASK_REWARD_EUR.toFixed(2)} €*\n\n` +

      `La soumission sera d'abord enregistrée en *PENDING*.\n\n` +

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
    );
  }
);

// ====================================================
// 19. AUTH 2FA
// ====================================================

bot.action(
  'auth_2fa',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `⚠️ *Méthode 2FA indisponible*\n\n` +

      `Cette méthode est momentanément suspendue.\n\n` +

      `Veuillez utiliser la méthode disponible.`,

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

// ====================================================
// 20. AUTH COOKIES / TASK PREPARATION
// ====================================================

bot.action(
  'auth_cookies',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(ctx.from.id);

    const identity =
      getRandomIdentity();

    const assignedPassword =
      DEFAULT_BOT_PASSWORD;

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
        assignedPassword
    };

    await renderScreen(

      ctx,

      `⚠️ *Informations de préparation*\n\n` +

      `✅ Prénom : \`${identity.firstName}\`\n` +

      `✅ Nom : \`${identity.lastName}\`\n\n` +

      `Une fois votre tâche terminée selon les règles autorisées, vous pourrez envoyer l'identifiant demandé.\n\n` +

      `⚠️ *Ne transmettez jamais de mot de passe personnel ou de jeton de session dans le chat.*`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '📥 Envoyer UID',
            'action_send_uid'
          )
        ],

        [
          Markup.button.callback(
            '🔙 Retour',
            'task_facebook'
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

// ====================================================
// 21. SEND UID
// ====================================================

bot.action(
  'action_send_uid',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(ctx.from.id);

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

      `Veuillez envoyer l'UID demandé :`,

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

// ====================================================
// 22. CANCEL
// ====================================================

bot.action(
  'action_cancel',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(ctx.from.id);

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

// ====================================================
// 23. TEXT INPUT
// ====================================================

bot.on(
  'text',
  async ctx => {

    const userId =
      String(ctx.from?.id || 'unknown');

    const username =
      ctx.from?.username ||
      ctx.from?.first_name ||
      'utilisateur';

    const text =
      ctx.message.text.trim();

    const lowerText =
      text.toLowerCase();

    const session =
      userSessions[userId];

    const user =
      getUserData(
        userId,
        ctx.from?.username,
        ctx.from?.first_name
      );

    // ==================================================
    // MENU
    // ==================================================

    if (
      text.includes('Solde') ||
      lowerText === 'solde' ||
      lowerText === '/solde' ||
      lowerText === '/balance'
    ) {
      return handleBalanceMenu(ctx);
    }

    if (
      text.includes('Tâches') ||
      text.includes('Taches') ||
      text.includes('Démarrer tâche') ||
      lowerText === 'taches' ||
      lowerText === 'tâches' ||
      lowerText === '/tasks' ||
      lowerText === '/taches' ||
      lowerText === '/task'
    ) {
      return handleTasksMenu(ctx);
    }

    if (
      text.includes('Retrait') ||
      lowerText === 'retrait' ||
      lowerText === '/withdraw' ||
      lowerText === '/retrait'
    ) {
      return handleWithdrawalMenu(ctx);
    }

    if (
      text.includes('Support') ||
      text.includes('Assistance') ||
      lowerText === 'support' ||
      lowerText === '/support'
    ) {
      return handleSupportMenu(ctx);
    }

    if (
      text.includes('Parrainage') ||
      text.includes('Parrainages') ||
      lowerText === 'parrainage' ||
      lowerText === '/referral'
    ) {
      return handleReferralMenu(ctx);
    }

    if (
      text.includes('Classement') ||
      lowerText === 'classement' ||
      lowerText === '/leaderboard' ||
      lowerText === '/top'
    ) {
      return handleLeaderboardMenu(ctx);
    }

    if (
      text.includes('Langue') ||
      text.includes('Langues') ||
      lowerText === 'langue' ||
      lowerText === 'language' ||
      lowerText === '/language' ||
      lowerText === '/langue'
    ) {
      return handleLanguageMenu(ctx);
    }

    // ==================================================
    // NO SESSION
    // ==================================================

    if (
      !session ||
      !session.step ||
      session.step === 'START'
    ) {

      return ctx.reply(

        `👋 Bonjour *${user.firstName}* !\n\n` +

        `Utilisez le menu ci-dessous pour continuer.`,

        {
          parse_mode: 'Markdown',

          ...MAIN_REPLY_KEYBOARD,

          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '🚀 Démarrer une tâche',
                'task_facebook'
              )
            ],

            [
              Markup.button.callback(
                '💰 Voir mon solde',
                'action_check_balance'
              )
            ]
          ])
        }
      );
    }

    // ==================================================
    // UID
    // ==================================================

    if (
      session.step === 'AWAITING_UID'
    ) {

      if (
        !/^\d{5,20}$/.test(text)
      ) {

        return ctx.reply(

          `⚠️ *UID invalide.*\n\n` +

          `Veuillez envoyer uniquement un identifiant numérique valide.`,

          {
            parse_mode: 'Markdown',

            ...Markup.inlineKeyboard([
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

      session.uid =
        text;

      session.step =
        'AWAITING_SUBMISSION_CONFIRMATION';

      return ctx.reply(

        `✅ *UID reçu.*\n\n` +

        `Votre soumission peut maintenant être enregistrée.\n\n` +

        `📌 Elle sera placée en *PENDING*.\n` +

        `🔎 Un administrateur devra la vérifier.\n\n` +

        `⚠️ Ne transmettez pas de mot de passe personnel ni de jeton de session.`,

        {
          parse_mode: 'Markdown',

          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '✅ Soumettre la tâche',
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
    }

    // ==================================================
    // OLD COOKIE STEP
    // ==================================================

    if (
      session.step === 'AWAITING_COOKIES'
    ) {

      return ctx.reply(

        `ℹ️ *Soumission sécurisée*\n\n` +

        `Le bot ne demande pas de session cookie ou de jeton d'authentification dans le chat.\n\n` +

        `Utilisez le bouton de soumission pour enregistrer votre tâche.`,

        {
          parse_mode: 'Markdown',

          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '✅ Soumettre',
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
    }

    // ==================================================
    // CONFIRMATION
    // ==================================================

    if (
      session.step ===
      'AWAITING_SUBMISSION_CONFIRMATION'
    ) {

      return ctx.reply(

        `ℹ️ Utilisez le bouton *✅ Soumettre la tâche* ci-dessus pour confirmer.`,

        {
          parse_mode: 'Markdown'
        }
      );
    }
  }
);

// ====================================================
// 24. CONFIRM TASK SUBMISSION
// ====================================================

bot.action(
  'confirm_task_submission',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(ctx.from.id);

    const username =
      ctx.from.username ||
      ctx.from.first_name ||
      'utilisateur';

    const session =
      userSessions[userId];

    const user =
      getUserData(
        userId,
        ctx.from.username,
        ctx.from.first_name
      );

    if (
      !session ||
      !session.uid
    ) {

      return renderScreen(

        ctx,

        `❌ *Session expirée.*\n\n` +
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

    const taskRecord = {

      id:
        `task-${Date.now()}-${userId}`,

      uid:
        session.uid,

      telegramUserId:
        userId,

      telegramUsername:
        username,

      firstName:
        session.firstName ||
        user.firstName ||
        'Utilisateur',

      lastName:
        session.lastName ||
        '',

      taskType:
        session.taskType ||
        'Facebook',

      // ================================================
      // VALIDATION
      // ================================================

      status:
        'pending',

      validation_status:
        'pending',

      // ================================================
      // REWARD
      // ================================================

      reward_amount:
        TASK_REWARD_EUR,

      reward_paid:
        false,

      reward_paid_at:
        null,

      // ================================================
      // ADMIN
      // ================================================

      validated_at:
        null,

      validated_by:
        null,

      validation_reason:
        null,

      // ================================================
      // ACCOUNT STATE
      // ================================================

      account_created:
        false,

      account_created_at:
        null,

      timestamp:
        new Date().toISOString(),

      notes:
        `Soumission reçue via ${PLATFORM_NAME}. ` +
        `Statut initial : PENDING. ` +
        `Validation administrateur requise.`
    };

    try {

      // ================================================
      // ADD PENDING
      // ================================================

      if (
        !Array.isArray(
          user.pendingTasks
        )
      ) {
        user.pendingTasks = [];
      }

      user.pendingTasks.push(
        taskRecord
      );

      // ================================================
      // GOOGLE SHEETS
      // ================================================

      await syncToGoogleSheets(
        {
          ...taskRecord,

          syncAction:
            'insert_task'
        }
      );

      // ================================================
      // CLEAR SESSION
      // ================================================

      delete userSessions[userId];

      // ================================================
      // RESPONSE
      // ================================================

      await ctx.reply(

        `⏳ *Soumission reçue !*\n\n` +

        `🆔 Task ID : ` +
        `\`${taskRecord.id}\`\n\n` +

        `📌 Statut : *PENDING*\n` +

        `💵 Reward prévu : ` +
        `*${TASK_REWARD_EUR.toFixed(2)} €*\n\n` +

        `🔎 Votre tâche doit maintenant être vérifiée par un administrateur.\n\n` +

        `💰 *Aucun reward n'a encore été crédité.*\n\n` +

        `Vous recevrez automatiquement une notification après la décision.`,

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
                '💰 Mon solde',
                'action_check_balance'
              )
            ]
          ])
        }
      );

      console.log(
        `[TASK PENDING] ` +
        `id=${taskRecord.id} ` +
        `user=${userId} ` +
        `uid=${taskRecord.uid}`
      );

    } catch (error) {

      console.error(
        '[TASK SUBMISSION ERROR]',
        error
      );

      // Remove task if saving failed
      user.pendingTasks =
        user.pendingTasks.filter(
          task =>
            task.id !==
            taskRecord.id
        );

      await ctx.reply(

        `❌ *Erreur d'enregistrement.*\n\n` +

        `La tâche n'a pas été validée et aucun reward n'a été crédité.`,

        {
          parse_mode: 'Markdown',

          ...MAIN_REPLY_KEYBOARD
        }
      );
    }
  }
);

// ====================================================
// 25. MY TASKS
// ====================================================

bot.action(
  'action_my_tasks',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(ctx.from.id);

    const user =
      getUserData(
        userId,
        ctx.from.username,
        ctx.from.first_name
      );

    const tasks =
      Array.isArray(user.pendingTasks)
        ? user.pendingTasks
        : [];

    if (
      tasks.length === 0
    ) {

      return renderScreen(

        ctx,

        `📋 *Mes tâches*\n\n` +

        `Aucune tâche en attente de validation.\n\n` +

        `📊 Tâches validées : ` +
        `*${user.tasksCompleted}*\n` +

        `💰 Solde : ` +
        `*${Number(user.balance || 0).toFixed(2)} €*`,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🚀 Nouvelle tâche',
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

    let message =
      `📋 *Mes tâches PENDING*\n\n`;

    for (
      const task of tasks.slice(-10)
    ) {

      message +=
        `🆔 \`${task.id}\`\n` +
        `📌 Statut : *${String(task.validation_status || 'pending').toUpperCase()}*\n` +
        `💵 Reward : *${Number(task.reward_amount || TASK_REWARD_EUR).toFixed(2)} €*\n` +
        `📅 ${new Date(task.timestamp).toLocaleString()}\n\n`;
    }

    message +=
      `ℹ️ Le reward reste bloqué jusqu'à la validation administrative.`;

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
            '💰 Mon solde',
            'action_check_balance'
          )
        ]
      ])
    );
  }
);

// ====================================================
// 26. ADMIN - /ADMIN
// ====================================================

bot.command(
  'admin',
  async ctx => {

    const adminId =
      String(ctx.from.id);

    if (
      !isAdmin(adminId)
    ) {

      return ctx.reply(
        `⛔ Accès administrateur refusé.`
      );
    }

    let totalPending = 0;

    for (
      const userId of Object.keys(userLedger)
    ) {

      const user =
        userLedger[userId];

      if (
        Array.isArray(
          user.pendingTasks
        )
      ) {

        totalPending +=
          user.pendingTasks.length;
      }
    }

    await ctx.reply(

      `🛡️ *ADMIN PANEL*\n\n` +

      `👤 Admin ID : \`${adminId}\`\n\n` +

      `⏳ Tâches PENDING : *${totalPending}*\n\n` +

      `Choisissez une action :`,

      {
        parse_mode: 'Markdown',

        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `⏳ Voir les PENDING (${totalPending})`,
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

// ====================================================
// 27. ADMIN PANEL CALLBACK
// ====================================================

bot.action(
  'admin_panel',
  async ctx => {

    await ctx.answerCbQuery();

    const adminId =
      String(ctx.from.id);

    if (
      !isAdmin(adminId)
    ) {

      return renderScreen(
        ctx,
        `⛔ Accès administrateur refusé.`
      );
    }

    let totalPending = 0;

    for (
      const userId of Object.keys(userLedger)
    ) {

      const user =
        userLedger[userId];

      if (
        Array.isArray(
          user.pendingTasks
        )
      ) {
        totalPending +=
          user.pendingTasks.length;
      }
    }

    await renderScreen(

      ctx,

      `🛡️ *ADMIN PANEL*\n\n` +

      `👤 Admin : \`${adminId}\`\n\n` +

      `⏳ Tâches PENDING : *${totalPending}*`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `⏳ Voir les PENDING (${totalPending})`,
            'admin_pending'
          )
        ]
      ])
    );
  }
);

// ====================================================
// 28. ADMIN - LIST PENDING
// ====================================================

bot.command(
  'pending',
  async ctx => {

    const adminId =
      String(ctx.from.id);

    if (
      !isAdmin(adminId)
    ) {

      return ctx.reply(
        `⛔ Accès administrateur refusé.`
      );
    }

    await sendAdminPendingList(
      ctx
    );
  }
);

bot.action(
  'admin_pending',
  async ctx => {

    await ctx.answerCbQuery();

    const adminId =
      String(ctx.from.id);

    if (
      !isAdmin(adminId)
    ) {

      return renderScreen(
        ctx,
        `⛔ Accès administrateur refusé.`
      );
    }

    await sendAdminPendingList(
      ctx
    );
  }
);

// ====================================================
// SEND ADMIN PENDING LIST
// ====================================================

async function sendAdminPendingList(ctx) {

  const pending = [];

  for (
    const userId of Object.keys(userLedger)
  ) {

    const user =
      userLedger[userId];

    if (
      !Array.isArray(
        user.pendingTasks
      )
    ) {
      continue;
    }

    for (
      const task of user.pendingTasks
    ) {

      if (
        task.validation_status ===
          'pending' ||
        task.status ===
          'pending'
      ) {

        pending.push({
          userId,
          user,
          task
        });
      }
    }
  }

  if (
    pending.length === 0
  ) {

    return renderScreen(

      ctx,

      `✅ *Aucune tâche PENDING.*\n\n` +
      `Toutes les tâches en attente ont été traitées.`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🔄 Actualiser',
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
  }

  const items =
    pending.slice(0, 20);

  let message =
    `⏳ *TÂCHES PENDING*\n\n`;

  const buttons = [];

  for (
    const item of items
  ) {

    message +=
      `👤 ${item.user.firstName || 'Utilisateur'}\n` +
      `🆔 \`${item.task.id}\`\n` +
      `📌 UID : \`${item.task.uid}\`\n` +
      `💵 Reward : *${Number(item.task.reward_amount || TASK_REWARD_EUR).toFixed(2)} €*\n\n`;

    buttons.push([
      Markup.button.callback(
        `🔎 ${item.task.id}`,
        `admin_view:${item.task.id}`
      )
    ]);
  }

  if (
    pending.length > 20
  ) {

    message +=
      `_Affichage des 20 premières tâches._`;
  }

  buttons.push([
    Markup.button.callback(
      '🔄 Actualiser',
      'admin_pending'
    )
  ]);

  await renderScreen(
    ctx,
    message,
    Markup.inlineKeyboard(
      buttons
    )
  );
}

// ====================================================
// 29. ADMIN - VIEW TASK
// ====================================================

bot.action(
  /^admin_view:(.+)$/,
  async ctx => {

    await ctx.answerCbQuery();

    const adminId =
      String(ctx.from.id);

    if (
      !isAdmin(adminId)
    ) {

      return renderScreen(
        ctx,
        `⛔ Accès administrateur refusé.`
      );
    }

    const taskId =
      ctx.match[1];

    const result =
      findPendingTask(taskId);

    if (!result) {

      return renderScreen(

        ctx,

        `⚠️ *Tâche introuvable.*\n\n` +
        `Elle a peut-être déjà été validée ou rejetée.`,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🔄 PENDING',
              'admin_pending'
            )
          ]
        ])
      );
    }

    const {
      user,
      task
    } = result;

    await renderScreen(

      ctx,

      `🔎 *DÉTAIL DE LA TÂCHE*\n\n` +

      `🆔 Task ID : \`${task.id}\`\n` +

      `👤 Worker : *${user.firstName || 'Utilisateur'}*\n` +

      `📱 Username : @${task.telegramUsername || 'utilisateur'}\n` +

      `🆔 Telegram ID : \`${task.telegramUserId}\`\n` +

      `📌 UID : \`${task.uid}\`\n\n` +

      `📋 Type : *${task.taskType}*\n` +

      `📌 Statut : *PENDING*\n` +

      `💵 Reward : *${Number(task.reward_amount || TASK_REWARD_EUR).toFixed(2)} €*\n\n` +

      `📅 Reçue : ${new Date(task.timestamp).toLocaleString()}\n\n` +

      `Choisissez la décision administrative :`,

      Markup.inlineKeyboard([

        [
          Markup.button.callback(
            '✅ VALIDER',
            `admin_validate:${task.id}`
          ),

          Markup.button.callback(
            '❌ REJETER',
            `admin_reject:${task.id}`
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

// ====================================================
// 30. ADMIN VALIDATE
// ====================================================

bot.action(
  /^admin_validate:(.+)$/,
  async ctx => {

    await ctx.answerCbQuery();

    const adminId =
      String(ctx.from.id);

    if (
      !isAdmin(adminId)
    ) {

      return renderScreen(
        ctx,
        `⛔ Accès administrateur refusé.`
      );
    }

    const taskId =
      ctx.match[1];

    const result =
      findPendingTask(taskId);

    if (!result) {

      return renderScreen(

        ctx,

        `⚠️ *Tâche introuvable ou déjà traitée.*`,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🔄 PENDING',
              'admin_pending'
            )
          ]
        ])
      );
    }

    const {
      user,
      task,
      taskIndex
    } = result;

    // ==================================================
    // DOUBLE VALIDATION PROTECTION
    // ==================================================

    if (
      task.validation_status !==
        'pending' &&
      task.status !==
        'pending'
    ) {

      return renderScreen(
        ctx,
        `⚠️ Cette tâche a déjà été traitée.`
      );
    }

    const now =
      new Date().toISOString();

    const reward =
      Number(
        task.reward_amount ||
        TASK_REWARD_EUR
      );

    // ==================================================
    // UPDATE VALIDATION
    // ==================================================

    task.status =
      'validated';

    task.validation_status =
      'validated';

    task.validated_at =
      now;

    task.validated_by =
      adminId;

    task.validation_reason =
      null;

    task.reward_paid =
      true;

    task.reward_paid_at =
      now;

    /*
     * account_created remains unchanged here.
     *
     * Validation admin ≠ automatic account creation.
     */
    task.account_created =
      Boolean(
        task.account_created
      );

    // ==================================================
    // CREDIT WORKER
    // ==================================================

    user.balance =
      Number(user.balance || 0) +
      reward;

    user.tasksCompleted =
      Number(user.tasksCompleted || 0) +
      1;

    // ==================================================
    // REFERRAL COMMISSION
    // ==================================================

    if (
      user.referredBy &&
      userLedger[user.referredBy]
    ) {

      const referrer =
        userLedger[
          user.referredBy
        ];

      referrer.balance =
        Number(
          referrer.balance || 0
        ) +
        REFERRAL_COMMISSION_EUR;

      referrer.referralEarnings =
        Number(
          referrer.referralEarnings || 0
        ) +
        REFERRAL_COMMISSION_EUR;

      console.log(
        `[Referral Reward] ` +
        `referrer=${user.referredBy} ` +
        `amount=${REFERRAL_COMMISSION_EUR}`
      );

      try {

        await bot.telegram.sendMessage(

          String(
            user.referredBy
          ),

          `🎉 *Commission de parrainage*\n\n` +

          `Une tâche de votre filleul a été validée.\n\n` +

          `💎 Commission : ` +
          `*+${REFERRAL_COMMISSION_EUR.toFixed(2)} €*\n\n` +

          `💰 Votre solde a été mis à jour.`,

          {
            parse_mode: 'Markdown'
          }
        );

      } catch (notifyError) {

        console.warn(
          '[Referral Notification]',
          notifyError.message
        );
      }
    }

    // ==================================================
    // GOOGLE SHEETS UPDATE
    // ==================================================

    const sheetResult =
      await syncToGoogleSheets({

        ...task,

        syncAction:
          'update_validation',

        status:
          'validated',

        validation_status:
          'validated',

        reward_paid:
          true,

        reward_paid_at:
          now,

        validated_at:
          now,

        validated_by:
          adminId,

        validation_reason:
          null,

        reward_amount:
          reward
      });

    // ==================================================
    // REMOVE FROM PENDING
    // ==================================================

    user.pendingTasks.splice(
      taskIndex,
      1
    );

    // ==================================================
    // WORKER NOTIFICATION
    // ==================================================

    try {

      await bot.telegram.sendMessage(

        String(
          user.userId
        ),

        `🎉 *TÂCHE VALIDÉE !*\n\n` +

        `🆔 Task ID : \`${task.id}\`\n` +

        `📌 Statut : *VALIDATED* ✅\n\n` +

        `💰 Reward crédité : ` +
        `*+${reward.toFixed(2)} €*\n\n` +

        `💵 Nouveau solde : ` +
        `*${Number(user.balance).toFixed(2)} €*\n\n` +

        `Merci pour votre soumission.`,

        {
          parse_mode: 'Markdown'
        }
      );

    } catch (notifyError) {

      console.warn(
        '[Worker Notification]',
        notifyError.message
      );
    }

    // ==================================================
    // ADMIN RESPONSE
    // ==================================================

    await renderScreen(

      ctx,

      `✅ *TÂCHE VALIDÉE*\n\n` +

      `🆔 \`${task.id}\`\n` +

      `👤 Worker : ${user.firstName}\n` +

      `💵 Reward : *+${reward.toFixed(2)} €*\n\n` +

      `💰 Nouveau solde worker : ` +
      `*${Number(user.balance).toFixed(2)} €*\n\n` +

      `🛡️ Validé par : \`${adminId}\`\n` +

      `📅 ${now}\n\n` +

      `Google Sheets : ` +
      `${sheetResult.success ? '✅ Sync OK' : '⚠️ Sync à vérifier'}`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '⏳ Voir PENDING',
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

    console.log(
      `[TASK VALIDATED] ` +
      `task=${task.id} ` +
      `worker=${user.userId} ` +
      `reward=${reward} ` +
      `admin=${adminId}`
    );
  }
);

// ====================================================
// 31. ADMIN REJECT
// ====================================================

bot.action(
  /^admin_reject:(.+)$/,
  async ctx => {

    await ctx.answerCbQuery();

    const adminId =
      String(ctx.from.id);

    if (
      !isAdmin(adminId)
    ) {

      return renderScreen(
        ctx,
        `⛔ Accès administrateur refusé.`
      );
    }

    const taskId =
      ctx.match[1];

    const result =
      findPendingTask(taskId);

    if (!result) {

      return renderScreen(

        ctx,

        `⚠️ *Tâche introuvable ou déjà traitée.*`,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🔄 PENDING',
              'admin_pending'
            )
          ]
        ])
      );
    }

    const {
      user,
      task,
      taskIndex
    } = result;

    if (
      task.validation_status !==
        'pending' &&
      task.status !==
        'pending'
    ) {

      return renderScreen(
        ctx,
        `⚠️ Cette tâche a déjà été traitée.`
      );
    }

    const now =
      new Date().toISOString();

    const reason =
      'Soumission rejetée par l’administration après vérification.';

    // ==================================================
    // UPDATE
    // ==================================================

    task.status =
      'rejected';

    task.validation_status =
      'rejected';

    task.validated_at =
      now;

    task.validated_by =
      adminId;

    task.validation_reason =
      reason;

    task.reward_paid =
      false;

    task.reward_paid_at =
      null;

    // ==================================================
    // GOOGLE SHEETS
    // ==================================================

    const sheetResult =
      await syncToGoogleSheets({

        ...task,

        syncAction:
          'update_validation',

        status:
          'rejected',

        validation_status:
          'rejected',

        reward_paid:
          false,

        reward_paid_at:
          null,

        validated_at:
          now,

        validated_by:
          adminId,

        validation_reason:
          reason
      });

    // ==================================================
    // REMOVE FROM PENDING
    // ==================================================

    user.pendingTasks.splice(
      taskIndex,
      1
    );

    // ==================================================
    // NOTIFY WORKER
    // ==================================================

    try {

      await bot.telegram.sendMessage(

        String(
          user.userId
        ),

        `❌ *TÂCHE REJETÉE*\n\n` +

        `🆔 Task ID : \`${task.id}\`\n` +

        `📌 Statut : *REJECTED*\n\n` +

        `📝 Motif :\n` +
        `${reason}\n\n` +

        `💰 Reward : *0.00 €*\n\n` +

        `ℹ️ Aucun montant n'a été ajouté à votre solde.`,

        {
          parse_mode: 'Markdown'
        }
      );

    } catch (notifyError) {

      console.warn(
        '[Worker Notification]',
        notifyError.message
      );
    }

    // ==================================================
    // ADMIN RESPONSE
    // ==================================================

    await renderScreen(

      ctx,

      `❌ *TÂCHE REJETÉE*\n\n` +

      `🆔 \`${task.id}\`\n` +

      `👤 Worker : ${user.firstName}\n\n` +

      `📝 Motif :\n${reason}\n\n` +

      `💰 Reward : *0.00 €*\n\n` +

      `🛡️ Décision par : \`${adminId}\`\n` +

      `Google Sheets : ` +
      `${sheetResult.success ? '✅ Sync OK' : '⚠️ Sync à vérifier'}`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '⏳ Voir PENDING',
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

    console.log(
      `[TASK REJECTED] ` +
      `task=${task.id} ` +
      `worker=${user.userId} ` +
      `admin=${adminId}`
    );
  }
);

// ====================================================
// 32. BALANCE CALLBACK
// ====================================================

bot.action(
  'action_check_balance',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(ctx.from.id);

    const user =
      getUserData(
        userId,
        ctx.from.username,
        ctx.from.first_name
      );

    const pendingTasks =
      Array.isArray(
        user.pendingTasks
      )
        ? user.pendingTasks.filter(
            task =>
              task.validation_status ===
                'pending' ||
              task.status ===
                'pending'
          )
        : [];

    const pendingAmount =
      pendingTasks.reduce(
        (total, task) =>
          total +
          Number(
            task.reward_amount || 0
          ),
        0
      );

    await renderScreen(

      ctx,

      `💰 *Votre Solde*\n\n` +

      `💵 Solde disponible : ` +
      `*${Number(user.balance || 0).toFixed(2)} €*\n\n` +

      `📊 Tâches validées : ` +
      `*${user.tasksCompleted || 0}*\n\n` +

      `⏳ Tâches PENDING : ` +
      `*${pendingTasks.length}*\n\n` +

      `💶 Reward en attente : ` +
      `*${pendingAmount.toFixed(2)} €*\n\n` +

      `ℹ️ Les rewards PENDING seront crédités uniquement après validation administrative.`,

      Markup.inlineKeyboard([
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
            '🏦 Retrait',
            'action_request_withdrawal'
          )
        ]
      ])
    );
  }
);

// ====================================================
// 33. WITHDRAWAL CALLBACK
// ====================================================

bot.action(
  'action_request_withdrawal',
  async ctx => {

    await ctx.answerCbQuery();

    const userId =
      String(ctx.from.id);

    const user =
      getUserData(
        userId,
        ctx.from.username,
        ctx.from.first_name
      );

    if (
      Number(user.balance || 0) <
      MIN_WITHDRAWAL_EUR
    ) {

      return renderScreen(

        ctx,

        `⚠️ *Solde insuffisant*\n\n` +

        `Solde : *${Number(user.balance || 0).toFixed(2)} €*\n` +

        `Minimum : *${MIN_WITHDRAWAL_EUR.toFixed(2)} €*\n\n` +

        `Les tâches PENDING ne sont pas comptabilisées pour le retrait.`,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🚀 Faire une tâche',
              'task_facebook'
            )
          ]
        ])
      );
    }

    await renderScreen(

      ctx,

      `🏦 *Sélectionnez votre méthode de retrait*`,

      Markup.inlineKeyboard([
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
            '💳 Virement bancaire',
            'withdraw_bank'
          )
        ]
      ])
    );
  }
);

// ====================================================
// 34. WITHDRAWAL METHODS
// ====================================================

bot.action(
  'withdraw_mobile_money',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `📱 *Retrait Mobile Money*\n\n` +

      `Contactez le support officiel pour transmettre les informations nécessaires.`,

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

      `Contactez le support officiel pour transmettre les informations nécessaires.`,

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

      `💳 *Virement bancaire*\n\n` +

      `Contactez le support officiel pour connaître la procédure.`,

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

// ====================================================
// 35. FAQ
// ====================================================

bot.action(
  'action_faq',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `❓ *FAQ*\n\n` +

      `*Q1 : Combien de temps prend la validation ?*\n` +

      `R : Après soumission, la tâche passe d'abord en *PENDING*. Un administrateur doit ensuite la vérifier.\n\n` +

      `*Q2 : Quand le reward est-il crédité ?*\n` +

      `R : Uniquement après validation administrative.\n\n` +

      `*Q3 : Que se passe-t-il si la tâche est rejetée ?*\n` +

      `R : Le statut devient *REJECTED* et aucun reward n'est crédité.`,

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

// ====================================================
// 36. CONTACT SUPPORT
// ====================================================

bot.action(
  'action_contact_support',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `📞 *Support ${PLATFORM_NAME}*\n\n` +

      `Contactez le support officiel pour toute question concernant votre tâche ou votre paiement.`,

      Markup.inlineKeyboard([
        [
          Markup.button.url(
            '💬 Ouvrir le Support',
            'https://t.me/TaskifySupport'
          )
        ],

        [
          Markup.button.callback(
            '🔙 Retour',
            'task_facebook'
          )
        ]
      ])
    );
  }
);

// ====================================================
// 37. TASK RULES
// ====================================================

bot.action(
  'action_task_rules',
  async ctx => {

    await ctx.answerCbQuery();

    await renderScreen(

      ctx,

      `📋 *Consignes & Règles*\n\n` +

      `1. Utilisez uniquement les informations autorisées pour votre tâche.\n\n` +

      `2. Vérifiez les informations avant de soumettre.\n\n` +

      `3. Ne transmettez jamais de mot de passe personnel ou de jeton de session dans le chat.\n\n` +

      `4. Une même tâche ne doit pas être soumise plusieurs fois.\n\n` +

      `5. Après soumission, le statut est *PENDING*.\n\n` +

      `6. La validation est effectuée par un administrateur.\n\n` +

      `7. Le reward est crédité uniquement après *VALIDATED*.`,

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

// ====================================================
// 38. ERROR HANDLING
// ====================================================

bot.catch(
  (err, ctx) => {

    console.error(
      `[Telegraf Error] ` +
      `user=${ctx.from?.id}:`,
      err
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

// ====================================================
// 39. HTTP HEALTH CHECK
// ====================================================

const server =
  http.createServer(
    (req, res) => {

      if (
        req.url === '/health' ||
        req.url === '/'
      ) {

        res.writeHead(
          200,
          {
            'Content-Type':
              'application/json'
          }
        );

        res.end(
          JSON.stringify({

            status:
              'ok',

            bot:
              `${PLATFORM_NAME} (@TaskifyProBot)`,

            uptime:
              process.uptime(),

            sheetsSync:
              Boolean(
                GOOGLE_SHEET_WEBHOOK_URL
              ),

            adminsConfigured:
              ADMIN_TELEGRAM_IDS.length,

            timestamp:
              new Date().toISOString()
          })
        );

        return;
      }

      res.writeHead(404);

      res.end();
    }
  );

server.listen(
  PORT,
  () => {

    console.log(
      `[HTTP Server] Health check listening on port ${PORT}`
    );
  }
);

// ====================================================
// 40. START BOT
// ====================================================

bot.launch()
  .then(() => {

    console.log(
      '===================================================='
    );

    console.log(
      `🤖 [${PLATFORM_NAME}] (@TaskifyProBot) démarré !`
    );

    console.log(
      `🚀 Mode : Polling permanent`
    );

    console.log(
      `🌐 Google Sheets : ${
        GOOGLE_SHEET_WEBHOOK_URL
          ? 'Configuré ✅'
          : 'Non configuré ⚠️'
      }`
    );

    console.log(
      `🛡️ Admins configurés : ${
        ADMIN_TELEGRAM_IDS.length
      }`
    );

    console.log(
      `💰 Reward : ${TASK_REWARD_EUR.toFixed(2)} €`
    );

    console.log(
      '===================================================='
    );
  })
  .catch(err => {

    console.error(
      '❌ Impossible de lancer le bot Telegram :',
      err.message
    );
  });

// ====================================================
// 41. GRACEFUL SHUTDOWN
// ====================================================

process.once(
  'SIGINT',
  () => {

    console.log(
      'Arrêt du bot (SIGINT)...'
    );

    bot.stop('SIGINT');

    server.close();
  }
);

process.once(
  'SIGTERM',
  () => {

    console.log(
      'Arrêt du bot (SIGTERM)...'
    );

    bot.stop('SIGTERM');

    server.close();
  }
);
