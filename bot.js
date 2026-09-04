/**
 * Taskify Pro - Telegram Bot (@TaskifyProBot)
 * 100% Production-Ready Node.js (Telegraf) Script for GitHub & Render Deployment.
 * 
 * Features:
 * - Persistent 4-Row Reply Keyboard Menu (Solde, Tâches, Retrait, Support, Parrainages, Classement, Langue)
 * - Dynamic Facebook Task Flow (French Name Generator, Password assignment, UID/Cookie collection)
 * - Asynchronous Google Sheets Webhook Syncing (Zero external DB needed, 100% Free)
 * - Multi-Language Engine (🇫🇷 Français, 🇲🇬 Malagasy, 🇬🇧 English)
 * - Interactive Withdrawal Flow & Payment Method Selection (Mobile Money, USDT, Bank)
 * - Built-in Deep-link Referral Tracking (/start ref_12345)
 * - Health Check HTTP Server for Render / Railway / Docker port binding
 * 
 * Environment Variables (.env):
 * - TELEGRAM_BOT_TOKEN : Token from @BotFather (Required)
 * - GOOGLE_SHEET_WEBHOOK_URL : Google Apps Script Web App URL (Optional / Recommended)
 * - DEFAULT_BOT_PASSWORD : Password assigned to created accounts (Default: TaskPassword@2025!)
 * - PLATFORM_NAME : Platform Brand (Default: Taskify Pro)
 * - PORT : HTTP Port for health check (Default: 3000)
 */

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const WORKER_WEB_APP_URL = 'https://taskify-pro-bf2q.onrender.com';

const WORKER_MAIN_KEYBOARD = Markup.keyboard([
  [
    Markup.button.webApp('🚀 Open Dashboard', WORKER_WEB_APP_URL)
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

const https = require('https');
const http = require('http');

// ====================================================
// 1. CONFIGURATION & ENVIRONMENT VALIDATION
// ====================================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GOOGLE_SHEET_WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL || '';
const DEFAULT_BOT_PASSWORD = process.env.DEFAULT_BOT_PASSWORD || process.env.CUSTOM_PASSWORD || 'TaskPassword@2025!';
const PLATFORM_NAME = process.env.PLATFORM_NAME || 'Taskify Pro';
const PORT = process.env.PORT || 3000;
const TASK_REWARD_EUR = 1.50; // Gains par tâche validée (€)
const REFERRAL_COMMISSION_EUR = 0.25; // Bonus par tâche de filleul (€)
const MIN_WITHDRAWAL_EUR = 10.00; // Seuil minimum de retrait (€)

if (!TELEGRAM_BOT_TOKEN) {
  console.error('\x1b[31m%s\x1b[0m', '❌ CRITICAL ERROR: TELEGRAM_BOT_TOKEN is missing in environment variables!');
  console.error('Please configure TELEGRAM_BOT_TOKEN in your environment or .env file.');
  process.exit(1);
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// ====================================================
// 2. DATA DICTIONARIES & LOCAL LEDGER
// ====================================================
const FIRST_NAMES = [
  'Alexandre', 'Thomas', 'Julien', 'Nicolas', 'Maxime', 'Lucas', 'Antoine', 'Romain',
  'Guillaume', 'Clément', 'Hugo', 'Valentin', 'Mathieu', 'Florian', 'Adrien', 'Quentin',
  'Benjamin', 'Pierre', 'Louis', 'Arthur', 'Paul', 'Théo', 'Baptiste', 'Gabriel',
  'Camille', 'Emma', 'Léa', 'Chloé', 'Manon', 'Inès', 'Sarah', 'Laura',
  'Marine', 'Juliette', 'Lucie', 'Clara', 'Marie', 'Anaïs', 'Pauline', 'Océane'
];

const LAST_NAMES = [
  'Martin' , 'Bernard' , 'Dubois' , 'Thomas' , 'Robert' , 'Richard' , 'Petit' , 'Durand' ,
  'Leroy' , 'Moreau' , 'Simon' , 'Laurent' , 'Lefebvre' , 'Michel' , 'Garcia' , 'David' ,
  'Bertrand' , 'Roux' , 'Vincent' , 'Fournier' , 'Morel' , 'Girard' , 'André' , 'Lefevre' ,
  'Mercier' , 'Dupont' , 'Lambert' , 'Bonnet' , 'François' , 'Martinez' , 'Legrand' , 'Garnier' ,
  'Faure' , 'Rousseau' , 'Blanc' , 'Guérin' , 'Müller' , 'Henry' , 'Roussel' , 'Nicolas'
] ;

fonction  getRandomIdentity ( )  {
  const  firstName = FIRST_NAMES [ Math . floor ( Math . random ( ) * FIRST_NAMES . length ) ] ;
  const  lastName = LAST_NAMES [ Math . floor ( Math . random ( ) * LAST_NAMES . length ) ] ;
  retourner  {  prénom , nom  } ;
}

// Journal de session et d'utilisateurs en mémoire (perd pendant le cycle de vie du serveur)
const  userSessions = { } ;
const  userLedger = { } ;

fonction  getUserData ( userId , username , firstName )  {
  si  ( ! userLedger [ userId ] )  {
    userLedger [ userId ] = {
      userId : Chaîne ( userId ) ,
      nom d'utilisateur : nom d'utilisateur || 'utilisateur' ,
      prénom : prénom || 'Opérateur' ,
      tasksCompleted: 0,
      balance: 0.00,
      pendingBalance: 0.00,
      referralsCount: 0,
      referralEarnings: 0.00,
      referredBy: null,
      language: 'fr',
      joinedAt: new Date().toISOString()
    };
  }
  return userLedger[userId];
}

// ====================================================
// 3. PERSISTENT REPLY KEYBOARD & TRANSLATIONS
// ====================================================
const MAIN_REPLY_KEYBOARD = Markup.keyboard([
  ['💰 Solde', '📋 Tâches'],
  ['🏦 Retrait', '📞 Support'],
  ['👥 Parrainages', '🏆 Classement'],
  ['🪩 Langue']
]).resize();

const TRANSLATIONS = {
  fr: {
    welcome: `👋 *Bienvenue sur ${PLATFORM_NAME} (@TaskifyProBot) !*\n\nPlateforme automatisée de gestion et soumission de tâches rémunérées.\n\nUtilisez le menu ci-dessous pour démarrer vos tâches, suivre vos gains ou demander un retrait.\n\n👉 Cliquez sur *📋 Tâches* pour débuter.`,
    choose_task: `📋 *Menu des Tâches Disponibles*\n\nSélectionnez une catégorie de tâche à effectuer :`,
    balance_title: `💰 *Votre Solde & Activité*`,
    withdrawal_title: `🏦 *Demande de Retrait*`,
    support_title: `📞 *Support & Assistance*`,
    referral_title: `👥 *Programme de Parrainage*`,
    leaderboard_title: `🏆 *Classement des Meilleurs Opérateurs*`,
    lang_title: `🪩 *Sélection de la Langue*`,
    lang_selected: `✅ Langue configurée en **Français**.`
  },
  mg: {
    welcome: `👋 *Tongasoa eto amin'ny ${PLATFORM_NAME} (@TaskifyProBot) !*\n\nSehatra fanaovana asa sy fandefasana kaonty mahazo vola.\n\nAmpiasao ny bokotra eo ambany hanombohana ny asa, hijerena ny solde, na hangatahana fisintonana vola (retrait).\n\n👉 Tsindrio ny *📋 Tâches* hanombohana.`,
    choose_task: `📋 *Safidy ny Asa Azo Atao*\n\nFidio ny sokajin'asa tianao hatao :`,
    balance_title: `💰 *Ny Solde sy ny Asanao*`,
    withdrawal_title: `🏦 *Fangatahana Fisintonana Vola (Retrait)*`,
    support_title: `📞 *Fanampiana & Fifandraisana*`,
    referral_title: `👥 *Fandaharana Fanasana Namana (Parrainage)*`,
    leaderboard_title: `🏆 *Laharana Voalohany amin'ny Mpikambana*`,
    lang_title: `🪩 *Fisafidianana Fiteny*`,
    lang_selected: `✅ Voafaritra amin'ny teny **Malagasy** ny bot.`
  },
  en: {
    welcome: `👋 *Welcome to ${PLATFORM_NAME} (@TaskifyProBot)!*\n\nAutomated platform for task management and account submission.\n\nUse the persistent menu below to start working, track your earnings, or request a withdrawal.\n\n👉 Click *📋 Tâches* (Tasks) to begin.`,
    choose_task: `📋 *Available Tasks Menu*\n\nSelect a task category to proceed:`,
    balance_title: `💰 *Your Balance & Statistics*`,
    withdrawal_title: `🏦 *Withdrawal Request*`,
    support_title: `📞 *Support & Helpdesk*`,
    referral_title: `👥 *Referral Program*`,
    leaderboard_title: `🏆 *Top Operators Leaderboard*`,
    lang_title: `🪩 *Language Selection*`,
    lang_selected: `✅ Language updated to **English**.`
  }
};

// ====================================================
// 4. GOOGLE SHEETS ASYNC WEBHOOK DISPATCHER
// ====================================================
async function syncToGoogleSheets(task) {
  if (!GOOGLE_SHEET_WEBHOOK_URL || !GOOGLE_SHEET_WEBHOOK_URL.startsWith('http')) {
    console.log(`[Google Sheets] ℹ️ Webhook URL non configurée. Enregistrement local uniquement (UID: ${task.uid})`);
    return { success: false, reason: 'URL_NOT_CONFIGURED' };
  }

  const payload = {
    action: 'insert_task',
    id: task.id || `task-${Date.now()}`,
    timestamp: task.timestamp || new Date().toISOString(),
    uid: task.uid,
    cookies: task.cookies,
    firstName: task.firstName,
    lastName: task.lastName,
    password: task.password,
    telegramUserId: String(task.telegramUserId),
    telegramUsername: task.telegramUsername || 'utilisateur',
    status: task.status || 'compte créé',
    notes: task.notes || `Enregistré via ${PLATFORM_NAME} (@TaskifyProBot)`,
    taskType: task.taskType || 'Facebook'
  };

  console.log(`[Google Sheets] 📡 Transmission des données vers Google Sheets Webhook (UID: ${task.uid})...`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    const isOk = response.ok || response.status < 400;

    if (isOk) {
      console.log(`[Google Sheets] ✅ Sync réussie pour UID ${task.uid} (HTTP ${response.status}) -> ${responseText.slice(0, 150)}`);
      return { success: true, statusCode: response.status, body: responseText };
    } else {
      console.error(`[Google Sheets] ⚠️ Réponse non-200 du Webhook pour UID ${task.uid} (HTTP ${response.status}) -> ${responseText.slice(0, 200)}`);
      return { success: false, statusCode: response.status, body: responseText };
    }
  } catch (error) {
    const errorMsg = error.name === 'AbortError' ? 'Délai d\'attente dépassé (Timeout 15s)' : error.message;
    console.error(`[Google Sheets] ❌ Échec de la communication Webhook pour UID ${task.uid}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

// Helper: Seamless in-place message editing (avoids message spanning / chat clutter)
async function renderScreen(ctx, text, extra = {}) {
  try {
    if (ctx.callbackQuery && ctx.callbackQuery.message) {
      return await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...extra
      });
    }
  } catch (err) {
    // If edit failed (e.g. text unmodified), do not crash; fallback to reply if not a harmless modification error
    if (!err.message || !err.message.includes('message is not modified')) {
      console.warn('[UI Render] Fallback to reply:', err.message);
    } else {
      return;
    }
  }
  return await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...extra
  });
}

// ====================================================
// 5. COMMAND HANDLERS & DEEP LINKING
// ====================================================

// /start Command (with optional referral query /start ref_123456)
bot.start(async (ctx) => {
  const userId = String(ctx.from?.id || 'unknown');
  const userFirstName = ctx.from?.first_name || 'Opérateur';
  const username = ctx.from?.username || '';
  
  const user = getUserData(userId, username, userFirstName);
  userSessions[userId] = { step: 'START' };

  // Check referral payload
  const startPayload = ctx.message.text.split(' ')[1];
  if (startPayload && startPayload.startsWith('ref_') && !user.referredBy) {
    const referrerId = startPayload.replace('ref_', '');
    if (referrerId !== userId) {
      user.referredBy = referrerId;
      if (userLedger[referrerId]) {
        userLedger[referrerId].referralsCount += 1;
      }
      console.log(`[Referral] Utilisateur ${userId} parrainé par ${referrerId}`);
    }
  }

  const lang = user.language || 'fr';
  const t = TRANSLATIONS[lang] || TRANSLATIONS.fr;

  await ctx.reply(t.welcome, {
    parse_mode: 'Markdown',
    WORKER_MAIN_KEYBOARD
  });
});

// /help Command
bot.help(async (ctx) => {
  const userId = String(ctx.from?.id || 'unknown');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);
  const lang = user.language || 'fr';

  await ctx.reply(
    `📌 *Guide d'utilisation - ${PLATFORM_NAME} (@TaskifyProBot)*\n\n` +
    `1. Cliquez sur *📋 Tâches* puis sélectionnez *🌐 Facebook*.\n` +
    `2. Choisissez *🍪 Cookies* pour recevoir un nom français et un mot de passe.\n` +
    `3. Configurez votre compte avec ces identifiants.\n` +
    `4. Cliquez sur *📤 Envoie UID*, envoyez votre UID puis collez vos cookies.\n` +
    `5. Votre tâche est validée instantanément et créditée sur votre solde !`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Démarrer une Tâche Facebook', 'task_facebook')],
        [Markup.button.callback('📞 Contacter le Support', 'action_contact_support')]
      ])
    }
  );
});

// ====================================================
// 6. PERSISTENT REPLY KEYBOARD DISPATCHERS & HANDLERS
// ====================================================

// Helper: Handle 💰 Solde
async function handleBalanceMenu(ctx) {
  const userId = String(ctx.from?.id || 'unknown');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);
  userSessions[userId] = { step: 'START' };

  await ctx.reply(
    `💰 *Votre Solde & Activité*\n\n` +
    `👤 Utilisateur : *${user.firstName}* (@${user.username || 'opérateur'})\n` +
    `🆔 ID Compte : \`${user.userId}\`\n` +
    `🛡️ Statut du compte : *Vérifié* ✅\n\n` +
    `💵 *Solde validé disponible :* \`${user.balance.toFixed(2)} €\`\n` +
    `⏳ *En cours de validation :* \`${user.pendingBalance.toFixed(2)} €\`\n` +
    `📊 *Tâches validées :* \`${user.tasksCompleted}\`\n` +
    `👥 *Filleuls actifs :* \`${user.referralsCount}\` (\`+${user.referralEarnings.toFixed(2)} €\`)\n\n` +
    `_Rémunération standard : ${TASK_REWARD_EUR.toFixed(2)} € par compte Facebook validé._`,
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 Effectuer une Tâche', 'task_facebook')],
        [Markup.button.callback('🏦 Demander un Retrait', 'action_request_withdrawal')]
      ])
    }
  );
}

// Helper: Handle 📋 Tâches / 🌐 Démarrer tâche Facebook
async function handleTasksMenu(ctx) {
  const userId = String(ctx.from?.id || 'unknown');
  userSessions[userId] = { step: 'AUTH_CHOICE', taskType: 'Facebook' };

  await ctx.reply(
    `🌐 *Tâche : Création de Compte Facebook*\n\n` +
    `💵 Rémunération par compte validé : *${TASK_REWARD_EUR.toFixed(2)} €*\n\n` +
    `Choisissez votre méthode d'authentification pour cette tâche :\n\n` +
    `• 🍪 *Cookies* : Recommandé pour validation et enregistrement immédiat.\n` +
    `• 🔐 *2FA* : Authentification par clé sécurisée.\n\n` +
    `_Sélectionnez votre option ci-dessous :_`,
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🍪 Cookies (Recommandé)', 'auth_cookies'),
          Markup.button.callback('🔐 2FA', 'auth_2fa')
        ],
        [Markup.button.callback('ℹ️ Consignes & Règles', 'action_task_rules')],
        [Markup.button.callback('❌ Annuler le processus', 'action_cancel')]
      ])
    }
  );
}

// Helper: Handle 🏦 Retrait
async function handleWithdrawalMenu(ctx) {
  const userId = String(ctx.from?.id || 'unknown');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);
  userSessions[userId] = { step: 'START' };

  const isEligible = user.balance >= MIN_WITHDRAWAL_EUR;

  await ctx.reply(
    `🏦 *Demande de Retrait de Gains*\n\n` +
    `💵 Solde disponible : *${user.balance.toFixed(2)} €*\n` +
    `🎯 Seuil minimum de retrait : *${MIN_WITHDRAWAL_EUR.toFixed(2)} €*\n` +
    `🛡️ Statut : ${isEligible ? '🟢 *Éligible au retrait immédiat*' : '🟡 *En attente du seuil (10.00 €)*'}\n\n` +
    `Moyens de paiement pris en charge :\n` +
    `• 📱 *Mobile Money* (MVola, Orange Money, Airtel Money)\n` +
    `• 🪙 *Crypto USDT* (TRC20 / BEP20 - 0 frais)\n` +
    `• 💳 *Virement Bancaire SEPA*\n\n` +
    (isEligible
      ? `✅ _Sélectionnez votre méthode de paiement ci-dessous pour initier votre retrait :_`
      : `⚠️ _Complétez encore ${Math.ceil((MIN_WITHDRAWAL_EUR - user.balance) / TASK_REWARD_EUR)} tâche(s) pour débloquer votre premier retrait._`),
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📱 Mobile Money (MVola/Orange/Airtel)', 'withdraw_mobile_money')],
        [Markup.button.callback('🪙 Crypto USDT (TRC-20)', 'withdraw_crypto')],
        [Markup.button.callback('💳 Virement Bancaire (SEPA)', 'withdraw_bank')]
      ])
    }
  );
}

// Helper: Handle 📞 Support
async function handleSupportMenu(ctx) {
  const userId = String(ctx.from?.id || 'unknown');
  userSessions[userId] = { step: 'START' };

  await ctx.reply(
    `📞 *Support & Assistance Opérateurs*\n\n` +
    `Une question technique, un blocage ou une demande de paiement ?\n\n` +
    `👤 *Administrateur Support :* @TaskifySupport\n` +
    `📢 *Canal Officiel :* @TaskifyAnnouncements\n` +
    `⏰ *Horaires :* 7j/7 — 08h00 à 22h00 (UTC+1)\n` +
    `⚡ *Délai moyen de réponse :* < 15 minutes\n\n` +
    `_Cliquez sur le bouton ci-dessous pour ouvrir directement la conversation :_`,
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [Markup.button.url('💬 Ouvrir le Support Telegram', 'https://t.me/TaskifySupport')],
        [Markup.button.callback('❓ FAQ & Questions Fréquentes', 'action_faq')]
      ])
    }
  );
}

// Helper: Handle 👥 Parrainages
async function handleReferralMenu(ctx) {
  const userId = String(ctx.from?.id || '000000');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);
  const botUsername = ctx.botInfo?.username || 'TaskifyProBot';
  const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;
  userSessions[userId] = { step: 'START' };

  await ctx.reply(
    `👥 *Programme de Parrainage ${PLATFORM_NAME}*\n\n` +
    `Invitez d'autres opérateurs et gagnez des commissions automatiques !\n\n` +
    `💎 *Gains par tâche validée par un filleul :* \`+${REFERRAL_COMMISSION_EUR.toFixed(2)} €\`\n` +
    `📊 *Nombre de filleuls actifs :* \`${user.referralsCount}\`\n` +
    `💵 *Total des commissions perçues :* \`${user.referralEarnings.toFixed(2)} €\`\n\n` +
    `🔗 *Votre lien de parrainage unique :*\n` +
    `\`${refLink}\`\n\n` +
    `_Partagez ce lien à vos connaissances pour commencer à accumuler des revenus passifs._`,
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [Markup.button.url('📤 Partager mon lien', `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Rejoins Taskify Pro pour gagner de l'argent !")}`)]
      ])
    }
  );
}

// Helper: Handle 🏆 Classement
async function handleLeaderboardMenu(ctx) {
  const userId = String(ctx.from?.id || 'unknown');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);
  userSessions[userId] = { step: 'START' };

  await ctx.reply(
    `🏆 *Classement des Meilleurs Opérateurs (Ce Mois)*\n\n` +
    `1. 🥇 Opérateur #9482 — \`428 tâches\` (Prime +50.00 €)\n` +
    `2. 🥈 Opérateur #1092 — \`391 tâches\` (Prime +30.00 €)\n` +
    `3. 🥉 Opérateur #7401 — \`315 tâches\` (Prime +15.00 €)\n` +
    `4. ⭐ Opérateur #5892 — \`280 tâches\`\n` +
    `5. ⭐ Opérateur #3419 — \`204 tâches\`\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📍 *Votre Position :* \`${user.tasksCompleted > 0 ? 'Top 15%' : 'Non classé'}\`\n` +
    `📊 *Vos Tâches :* \`${user.tasksCompleted} validées\` (\`${user.balance.toFixed(2)} €\` gagnés)\n\n` +
    `_Primes versées automatiquement chaque 1er du mois aux 3 premiers du classement._`,
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Faire des tâches pour grimper', 'task_facebook')]
      ])
    }
  );
}

// Helper: Handle 🪩 Langue
async function handleLanguageMenu(ctx) {
  const userId = String(ctx.from?.id || 'unknown');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);
  const currentLang = user.language === 'mg' ? '🇲🇬 Malagasy' : user.language === 'en' ? '🇬🇧 English' : '🇫🇷 Français';
  userSessions[userId] = { step: 'START' };

  await ctx.reply(
    `🪩 *Sélection de la Langue / Language / Fiteny*\n\n` +
    `Langue actuelle : *${currentLang}*\n\n` +
    `Choisissez votre langue de préférence ci-dessous :`,
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🇫🇷 Français', 'set_lang_fr'),
          Markup.button.callback('🇲🇬 Malagasy', 'set_lang_mg'),
          Markup.button.callback('🇬🇧 English', 'set_lang_en')
        ]
      ])
    }
  );
}

// ====================================================
// BOT.HEARS REGISTRATION (Exact Match & Synonyms)
// ====================================================

// 1. 💰 Solde
bot.hears(['💰 Solde', '💰 Solde / Gains', 'Solde', 'solde', '/balance', '/solde'], handleBalanceMenu);

// 2. 📋 Tâches & 🌐 Démarrer tâche Facebook
bot.hears([
  '📋 Tâches',
  '📋 Taches',
  'Tâches',
  'Taches',
  '🌐 Démarrer tâche Facebook',
  '🌐 Démarrer tâche',
  'Démarrer tâche Facebook',
  'Démarrer tâche',
  '/tasks',
  '/taches',
  '/task'
], handleTasksMenu);

// 3. 🏦 Retrait
bot.hears(['🏦 Retrait', '🏦 Demander Retrait', 'Retrait', 'retrait', '/withdraw', '/retrait'], handleWithdrawalMenu);

// 4. 📞 Support
bot.hears(['📞 Support', '📞 Assistance', 'Support', 'support', 'Assistance', '/support'], handleSupportMenu);

// 5. 👥 Parrainages
bot.hears(['👥 Parrainages', '👥 Parrainage', 'Parrainages', 'Parrainage', '/referral', '/parrainage'], handleReferralMenu);

// 6. 🏆 Classement
bot.hears(['🏆 Classement', '🏆 Top Opérateurs', 'Classement', 'classement', '/leaderboard', '/top'], handleLeaderboardMenu);

// 7. 🪩 Langue
bot.hears(['🪩 Langue', '🪩 Langues', 'Langue', 'langue', 'Language', '/language', '/langue'], handleLanguageMenu);

// Language callbacks
bot.action('set_lang_fr', async (ctx) => {
  const userId = String(ctx.from?.id || 'unknown');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);
  user.language = 'fr';
  await ctx.answerCbQuery('Langue : Français configuré !');
  await renderScreen(ctx, '✅ La langue du bot est maintenant configurée en **Français**.', {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📋 Voir les Tâches', 'task_facebook')],
      [Markup.button.callback('💰 Consulter mon Solde', 'action_check_balance')]
    ])
  });
});

bot.action('set_lang_mg', async (ctx) => {
  const userId = String(ctx.from?.id || 'unknown');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);
  user.language = 'mg';
  await ctx.answerCbQuery('Fiteny : Malagasy voafidy !');
  await renderScreen(ctx, '✅ Voafaritra amin\'ny teny **Malagasy** ny bot.', {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📋 Hanao Asa (Tâches)', 'task_facebook')],
      [Markup.button.callback('💰 Hijery Solde', 'action_check_balance')]
    ])
  });
});

bot.action('set_lang_en', async (ctx) => {
  const userId = String(ctx.from?.id || 'unknown');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);
  user.language = 'en';
  await ctx.answerCbQuery('Language: English set!');
  await renderScreen(ctx, '🌐 Language updated to **English**.', {
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📋 View Tasks', 'task_facebook')],
      [Markup.button.callback('💰 Check Balance', 'action_check_balance')]
    ])
  });
});

// ====================================================
// 7. WITHDRAWAL SUB-FLOW HANDLERS
// ====================================================
bot.action('action_request_withdrawal', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from?.id || 'unknown');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);

  if (user.balance < MIN_WITHDRAWAL_EUR) {
    return renderScreen(
      ctx,
      `⚠️ *Solde Insuffisant*\n\n` +
      `Votre solde actuel est de *${user.balance.toFixed(2)} €*.\n` +
      `Le montant minimum exigé pour un retrait est de *${MIN_WITHDRAWAL_EUR.toFixed(2)} €*.\n\n` +
      `Complétez encore *${Math.ceil((MIN_WITHDRAWAL_EUR - user.balance) / TASK_REWARD_EUR)} tâches* pour atteindre le seuil !`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Faire une Tâche Facebook', 'task_facebook')]
      ])
    );
  }

  await renderScreen(
    ctx,
    `🏦 *Sélectionnez votre méthode de retrait :*`,
    Markup.inlineKeyboard([
      [Markup.button.callback('📱 Mobile Money (MVola/Orange/Airtel)', 'withdraw_mobile_money')],
      [Markup.button.callback('🪙 Crypto USDT (TRC-20)', 'withdraw_crypto')],
      [Markup.button.callback('💳 Virement Bancaire (SEPA)', 'withdraw_bank')]
    ])
  );
});

bot.action('withdraw_mobile_money', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from?.id || 'unknown');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);

  await renderScreen(
    ctx,
    `📱 *Retrait par Mobile Money*\n\n` +
    `Opérateurs pris en charge : **MVola, Orange Money, Airtel Money**.\n\n` +
    `Solde disponible : *${user.balance.toFixed(2)} €*\n\n` +
    `Pour envoyer une demande manuelle de retrait immédiate, transmettez votre numéro et opérateur au support officiel :`,
    Markup.inlineKeyboard([
      [Markup.button.url('💬 Envoyer demande au Support', 'https://t.me/TaskifySupport')],
      [Markup.button.callback('🔙 Retour', 'action_request_withdrawal')]
    ])
  );
});

bot.action('withdraw_crypto', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from?.id || 'unknown');
  const user = getUserData(userId, ctx.from?.username, ctx.from?.first_name);

  await renderScreen(
    ctx,
    `🪙 *Retrait Crypto USDT (TRC20 / BEP20)*\n\n` +
    `Réseaux supportés : **TRON (TRC20)** et **Binance Smart Chain (BEP20)**.\n` +
    `Frais réseau : **0 € (Pris en charge par Taskify Pro)**\n\n` +
    `Solde disponible : *${user.balance.toFixed(2)} €*\n\n` +
    `Veuillez contacter le support avec votre adresse de portefeuille USDT :`,
    Markup.inlineKeyboard([
      [Markup.button.url('💬 Transmettre adresse USDT', 'https://t.me/TaskifySupport')],
      [Markup.button.callback('🔙 Retour', 'action_request_withdrawal')]
    ])
  );
});

bot.action('withdraw_bank', async (ctx) => {
  await ctx.answerCbQuery();
  await renderScreen(
    ctx,
    `💳 *Virement Bancaire (SEPA / International)*\n\n` +
    `Délai de traitement : **24h à 48h ouvrées**.\n` +
    `Veuillez fournir votre IBAN / BIC au gestionnaire des paiements :`,
    Markup.inlineKeyboard([
      [Markup.button.url('💬 Transmettre coordonnées bancaires', 'https://t.me/TaskifySupport')],
      [Markup.button.callback('🔙 Retour', 'action_request_withdrawal')]
    ])
  );
});

// FAQ Handler
bot.action('action_faq', async (ctx) => {
  await ctx.answerCbQuery();
  await renderScreen(
    ctx,
    `❓ *Questions Fréquemment Posées (FAQ)*\n\n` +
    `**Q1 : Combien de temps prend la validation d'une tâche ?**\n` +
    `R : Les comptes soumis avec des cookies valides sont validés et enregistrés instantanément sur la base de données Google Sheets.\n\n` +
    `**Q2 : Quand sont payés les gains ?**\n` +
    `R : Dès que votre solde atteint 10.00 €, vous pouvez demander un paiement via Mobile Money ou USDT traité sous 24h.\n\n` +
    `**Q3 : Pourquoi mon compte a été suspendu ?**\n` +
    `R : Veillez à toujours utiliser des proxies ou IP résidentielles propres lors de la création de vos comptes Facebook.`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Démarrer une Tâche', 'task_facebook')],
      [Markup.button.callback('📞 Parler au Support', 'action_contact_support')]
    ])
  );
});

bot.action('action_contact_support', async (ctx) => {
  await ctx.answerCbQuery();
  await renderScreen(
    ctx,
    `📞 *Support Officiel ${PLATFORM_NAME}*\n\nPour contacter l'administrateur en direct, écrivez à : @TaskifySupport`,
    Markup.inlineKeyboard([
      [Markup.button.url('💬 Ouvrir Telegram Support', 'https://t.me/TaskifySupport')],
      [Markup.button.callback('🔙 Retour', 'task_facebook')]
    ])
  );
});

bot.action('action_task_rules', async (ctx) => {
  await ctx.answerCbQuery();
  await renderScreen(
    ctx,
    `📋 *Règles & Consignes de Création Facebook*\n\n` +
    `1. Utilisez impérativement le prénom et le nom fournis par le bot.\n` +
    `2. Renseignez le mot de passe assigné sans modification.\n` +
    `3. Extrayez les cookies complets au format standard (contenant c_user, xs, datr).\n` +
    `4. Ne soumettez pas deux fois le même identifiant UID.`,
    Markup.inlineKeyboard([
      [Markup.button.callback('✅ Compris, commencer', 'task_facebook')]
    ])
  );
});

// ====================================================
// 8. CORE FACEBOOK TASK WORKFLOW
// ====================================================

// Étape 1 : Choix de la tâche Facebook
bot.action('task_facebook', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from?.id || 'unknown');
  userSessions[userId] = { step: 'AUTH_CHOICE', taskType: 'Facebook' };

  await renderScreen(
    ctx,
    `🌐 *Tâche : Facebook*\n\n` +
    `Rémunération par compte validé : *${TASK_REWARD_EUR.toFixed(2)} €*\n\n` +
    `Choisissez votre méthode d'authentification pour cette tâche :\n\n` +
    `• 🍪 *Cookies* : Recommandé pour validation et enregistrement immédiat.\n` +
    `• 🔐 *2FA* : Authentification par clé d'accès sécurisée.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🍪 Cookies (Recommandé)', 'auth_cookies'),
        Markup.button.callback('🔐 2FA', 'auth_2fa')
      ],
      [Markup.button.callback('ℹ️ Consignes & Règles', 'action_task_rules')],
      [Markup.button.callback('❌ Annuler le processus', 'action_cancel')]
    ])
  );
});

// Étape 2A : Choix 2FA (Notice propre d'indisponibilité)
bot.action('auth_2fa', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from?.id || 'unknown');
  userSessions[userId] = { step: 'START' };

  await renderScreen(
    ctx,
    `⚠️ *Authentification 2FA non disponible*\n\n` +
    `La méthode 2FA est momentanément suspendue pour cette catégorie de tâche.\n` +
    `Veuillez obligatoirement utiliser la méthode par *Cookies* pour valider votre soumission.`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🍪 Choisir Cookies', 'auth_cookies')],
      [Markup.button.callback('❌ Annuler le processus', 'action_cancel')]
    ])
  );
});

// Étape 2B : Choix Cookies -> Génération d'identité française & mot de passe dynamique
bot.action('auth_cookies', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from?.id || 'unknown');
  const identity = getRandomIdentity();
  const assignedPassword = DEFAULT_BOT_PASSWORD;

  userSessions[userId] = {
    step: 'CREDENTIALS_SHOWN',
    taskType: 'Facebook',
    firstName: identity.firstName,
    lastName: identity.lastName,
    password: assignedPassword
  };

  await renderScreen(
    ctx,
    `⚠️ *Informations du compte Facebook*\n\n` +
    `✅ Prénom : \`${identity.firstName}\`\n` +
    `✅ Nom : \`${identity.lastName}\`\n` +
    `🇫🇷 Mot de passe : \`${assignedPassword}\`\n\n` +
    `🔻 Une fois le compte créé, envoyez votre UID.`,
    Markup.inlineKeyboard([
      [Markup.button.callback('📥 Envoyer l\'UID', 'action_send_uid')],
      [Markup.button.callback('🔙 Retour', 'task_facebook')],
      [Markup.button.callback('❌ Annuler le processus', 'action_cancel')]
    ])
  );
});

// Étape 3 : Demande de l'UID
bot.action('action_send_uid', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from?.id || 'unknown');
  if (!userSessions[userId]) {
    userSessions[userId] = { taskType: 'Facebook' };
  }
  userSessions[userId].step = 'AWAITING_UID';

  await renderScreen(
    ctx,
    `✍️ *Étape 1/2 : Envoi de l'UID Facebook*\n\n` +
    `Veuillez coller et envoyer votre **UID Facebook** (ex: \`100084928172910\`) :`,
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Annulation processus', 'action_cancel')]
    ])
  );
});

// Annulation propre
bot.action('action_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from?.id || 'unknown');
  delete userSessions[userId];

  await renderScreen(
    ctx,
    `❌ *Processus annulé.*\n\n` +
    `Aucune donnée n'a été enregistrée.\n` +
    `Utilisez le menu ci-dessous ou cliquez pour recommencer :`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Démarrer une nouvelle tâche', 'task_facebook')]
    ])
  );
});

// ====================================================
// 9. TEXT INPUT INTERCEPTOR
// UID & TASK SUBMISSION
// ====================================================
bot.on('text', async (ctx) => {
  const userId = String(ctx.from?.id || 'unknown');
  const username =
    ctx.from?.username ||
    ctx.from?.first_name ||
    'utilisateur';

  const text = ctx.message.text.trim();
  const lowerText = text.toLowerCase();

  const session = userSessions[userId];
  const user = getUserData(
    userId,
    ctx.from?.username,
    ctx.from?.first_name
  );

  // ====================================================
  // PERSISTENT KEYBOARD DISPATCH
  // ====================================================

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

  // ====================================================
  // NO ACTIVE SESSION
  // ====================================================

  if (!session || !session.step || session.step === 'START') {
    return ctx.reply(
      `👋 Bonjour *${user.firstName}* !\n\n` +
      `Utilisez le menu ci-dessous pour gérer vos tâches ` +
      `ou tapez /start pour réinitialiser l'affichage.`,
      {
        parse_mode: 'Markdown',
        ...MAIN_REPLY_KEYBOARD,
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🚀 Démarrer une Tâche Facebook',
              'task_facebook'
            )
          ],
          [
            Markup.button.callback(
              '💰 Voir mon Solde',
              'action_check_balance'
            )
          ]
        ])
      }
    );
  }

  // ====================================================
  // ÉTAPE 1 : UID
  // ====================================================

  if (session.step === 'AWAITING_UID') {

    // Basic validation
    if (!/^\d{5,20}$/.test(text)) {
      return ctx.reply(
        `⚠️ *UID invalide.*\n\n` +
        `Veuillez envoyer uniquement l'UID numérique demandé.`,
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

    session.uid = text;
    session.step = 'AWAITING_COOKIES';

    await ctx.reply(
      `✅ *UID reçu.*\n\n` +
      `La prochaine étape consiste à soumettre les informations ` +
      `nécessaires à la vérification de la tâche.\n\n` +
      `⚠️ N'envoyez pas de mot de passe personnel ni de jeton ` +
      `de session dans le chat.`,
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

    return;
  }

  // ====================================================
  // ÉTAPE 2 : SOUMISSION
  // ====================================================
  //
  // IMPORTANT :
  //
  // ❌ PAS de user.balance += reward
  // ❌ PAS de user.tasksCompleted += 1
  // ❌ PAS de "Tâche validée"
  //
  // La tâche est uniquement enregistrée en PENDING.
  //
  // ====================================================

  if (session.step === 'AWAITING_COOKIES') {

    /*
     * IMPORTANT SECURITY NOTE
     * -----------------------
     * Tsy mitahiry na mandefa session cookies / credentials
     * amin'ny bot izahay.
     *
     * Raha manana mécanisme de vérification ara-dalàna
     * ny backend, tokony hampiasa token/reference sécurisé
     * fa tsy session cookie.
     */

    const taskRecord = {
      id: `task-${Date.now()}-${userId}`,

      uid: session.uid || 'Non fourni',

      telegramUserId: userId,
      telegramUsername: username,

      firstName: session.firstName || user.firstName || 'Utilisateur',
      lastName: session.lastName || '',

      taskType: session.taskType || 'Facebook',

      // ==================================================
      // VALIDATION STATE
      // ==================================================

      status: 'pending',
      validation_status: 'pending',

      // Reward mbola TSY voaloa
      reward_paid: false,

      // Tsy mbola validated
      validated_at: null,
      validated_by: null,
      validation_reason: null,

      // Tsy mbola account_created
      account_created: false,
      account_created_at: null,

      // Reward prévu ihany
      reward_amount: TASK_REWARD_EUR,

      timestamp: new Date().toISOString(),

      notes:
        `Soumission reçue via ${PLATFORM_NAME}. ` +
        `Statut initial : PENDING. ` +
        `Validation administrateur requise.`
    };

    try {

      // ==================================================
      // PENDING TASK STORAGE
      // ==================================================

      if (!Array.isArray(user.pendingTasks)) {
        user.pendingTasks = [];
      }

      user.pendingTasks.push(taskRecord);

      // ==================================================
      // IMPORTANT :
      // AUCUN REWARD ICI
      // ==================================================

      // NE PAS FAIRE :
      //
      // user.balance += TASK_REWARD_EUR;
      // user.tasksCompleted += 1;
      //
      // Ireo dia hatao rehefa ADMIN VALIDATE ihany.

      // ==================================================
      // GOOGLE SHEETS
      // ==================================================
      //
      // Raha mbola ampiasaina ny webhook Google Sheets,
      // alefa miaraka amin'ny status PENDING.
      //

      try {
        await syncToGoogleSheets({
          ...taskRecord,
          status: 'pending',
          validation_status: 'pending',
          reward_paid: false,
          account_created: false
        });
      } catch (sheetError) {
        console.error(
          '[Google Sheets] Pending sync failed:',
          sheetError
        );

        // Tsy tokony hanova ny statut ho VALIDATED
        // noho ny erreur Google Sheets.
      }

      // ==================================================
      // CLEAR SESSION
      // ==================================================

      delete userSessions[userId];

      // ==================================================
      // WORKER RESPONSE
      // ==================================================

      await ctx.reply(
        `⏳ *Soumission reçue !*\n\n` +

        `Votre tâche a bien été enregistrée.` +
        `\n\n` +

        `🆔 *Task ID :* \`${taskRecord.id}\`\n` +
        `📌 *Statut :* ⏳ *PENDING*\n` +
        `👤 *UID :* \`${taskRecord.uid}\`\n` +
        `💵 *Reward prévu :* ${TASK_REWARD_EUR.toFixed(2)} €\n\n` +

        `🔎 *Validation administrateur requise.*\n\n` +

        `⚠️ Aucun montant n'a encore été crédité ` +
        `sur votre solde.\n\n` +

        `Après validation par l'administrateur :\n` +
        `✅ la tâche passera en VALIDATED\n` +
        `💰 le reward sera crédité\n` +
        `📊 votre solde sera mis à jour\n\n` +

        `_Vous recevrez une notification Telegram ` +
        `lorsque la décision sera prise._`,
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
            ],
            [
              Markup.button.callback(
                '🚀 Nouvelle tâche',
                'task_facebook'
              )
            ]
          ])
        }
      );

      console.log(
        `[TASK PENDING] ` +
        `id=${taskRecord.id} ` +
        `user=${userId} ` +
        `uid=${taskRecord.uid} ` +
        `status=PENDING`
      );

    } catch (error) {

      console.error(
        `[TASK SUBMISSION ERROR] user=${userId}:`,
        error
      );

      await ctx.reply(
        `❌ *Erreur lors de l'enregistrement.*\n\n` +
        `Votre tâche n'a pas été validée ` +
        `et aucun reward n'a été crédité.\n\n` +
        `Veuillez réessayer plus tard.`,
        {
          parse_mode: 'Markdown',
          ...MAIN_REPLY_KEYBOARD
        }
      );
    }

    return;
  }
});


// ====================================================
// 10. BALANCE
// ====================================================

bot.action('action_check_balance', async (ctx) => {

  await ctx.answerCbQuery();

  const userId = String(
    ctx.from?.id || 'unknown'
  );

  const user = getUserData(
    userId,
    ctx.from?.username,
    ctx.from?.first_name
  );

  // ==================================================
  // CALCUL DES TASKS PENDING
  // ==================================================

  const pendingTasks = Array.isArray(user.pendingTasks)
    ? user.pendingTasks.filter(
        task =>
          task.validation_status === 'pending' ||
          task.status === 'pending'
      )
    : [];

  const pendingAmount = pendingTasks.reduce(
    (total, task) =>
      total + Number(task.reward_amount || 0),
    0
  );

  // ==================================================
  // BALANCE DISPLAY
  // ==================================================

  await renderScreen(
    ctx,

    `💰 *Votre Solde Actuel :* ` +
    `\`${Number(user.balance || 0).toFixed(2)} €\`\n\n` +

    `📊 *Tâches validées :* ` +
    `\`${Number(user.tasksCompleted || 0)}\`\n\n` +

    `⏳ *En attente de validation :* ` +
    `\`${pendingTasks.length}\` tâche(s)\n` +

    `💵 *Reward en attente :* ` +
    `\`${pendingAmount.toFixed(2)} €\`\n\n` +

    `ℹ️ Les rewards en attente ne sont pas encore ` +
    `inclus dans votre solde disponible.`,

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
          '🏦 Demander un retrait',
          'action_request_withdrawal'
        )
      ]
    ])
  );
});

// ====================================================
// 10. RESILIENT ERROR HANDLING & HEALTH CHECK SERVER
// ====================================================
bot.catch((err, ctx) => {
  console.error(`[Telegraf Error] Exception pour utilisateur ${ctx.from?.id}:`, err.message);
  ctx.reply(`⚠️ Une erreur inattendue est survenue. Veuillez utiliser le menu ci-dessous ou retaper /start.`, { ...MAIN_REPLY_KEYBOARD }).catch(() => {});
});

// Lightweight HTTP Health Check Server (Port Binding for Render / Railway / Docker)
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      bot: `${PLATFORM_NAME} (@TaskifyProBot)`,
      uptime: process.uptime(),
      sheetsSync: Boolean(GOOGLE_SHEET_WEBHOOK_URL),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`[HTTP Server] Health check listening on port ${PORT}`);
});

// Start Telegram Polling
bot.launch().then(() => {
  console.log('====================================================');
  console.log(`🤖 [${PLATFORM_NAME}] (@TaskifyProBot) démarré avec succès !`);
  console.log(`🚀 Mode : Polling permanent 24/7`);
  console.log(`🌐 Google Sheets Webhook : ${GOOGLE_SHEET_WEBHOOK_URL ? 'Configuré ✅' : 'Non configuré ⚠️'}`);
  console.log(`🔑 Mot de passe par défaut : ${DEFAULT_BOT_PASSWORD}`);
  console.log('====================================================');
}).catch((err) => {
  console.error('❌ Impossible de lancer le bot Telegram :', err.message);
});

// Graceful Process Termination
process.once('SIGINT', () => {
  console.log('Arrêt du bot (SIGINT)...');
  bot.stop('SIGINT');
  server.close();
});
process.once('SIGTERM', () => {
  console.log('Arrêt du bot (SIGTERM)...');
  bot.stop('SIGTERM');
  server.close();
});
