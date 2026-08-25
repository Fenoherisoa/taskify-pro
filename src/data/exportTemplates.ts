export const STANDALONE_TEMPLATES = {
  botJs: `/**
 * Taskify Pro - Telegram Bot (@TaskifyProBot)
 * 100% Production-ready for Render, Railway, Vercel or VPS.
 * 
 * Requirements:
 * 1. npm install telegraf dotenv
 * 2. Configure .env (TELEGRAM_BOT_TOKEN, GOOGLE_SHEET_WEBHOOK_URL, DEFAULT_BOT_PASSWORD)
 * 3. node bot.js
 */

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const https = require('https');
const http = require('http');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GOOGLE_SHEET_WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL || '';
const DEFAULT_BOT_PASSWORD = process.env.DEFAULT_BOT_PASSWORD || process.env.CUSTOM_PASSWORD || 'TaskPassword@2025!';
const PLATFORM_NAME = process.env.PLATFORM_NAME || 'Taskify Pro';
const PORT = process.env.PORT || 3000;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ ERREUR : TELEGRAM_BOT_TOKEN manquant dans les variables d\\'environnement !');
  process.exit(1);
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

const FIRST_NAMES = [
  'Alexandre', 'Thomas', 'Julien', 'Nicolas', 'Maxime', 'Lucas', 'Antoine', 'Romain',
  'Guillaume', 'Clément', 'Hugo', 'Valentin', 'Mathieu', 'Florian', 'Adrien', 'Quentin',
  'Camille', 'Emma', 'Léa', 'Chloé', 'Manon', 'Inès', 'Sarah', 'Laura', 'Marie'
];
const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand',
  'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Dupont'
];

function getRandomIdentity() {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return { firstName, lastName };
}

// In-memory sessions
const sessions = {};

// Menu Principal persistant (Custom Reply Keyboard)
const MAIN_REPLY_KEYBOARD = Markup.keyboard([
  ['💰 Solde', '📋 Tâches'],
  ['🏦 Retrait', '📞 Support'],
  ['👥 Parrainages', '🏆 Classement'],
  ['🪩 Langue']
]).resize();

// Helper Google Sheets
function syncToGoogleSheets(task) {
  if (!GOOGLE_SHEET_WEBHOOK_URL || !GOOGLE_SHEET_WEBHOOK_URL.startsWith('http')) {
    console.log('[Sheets] Webhook non configuré. Enregistrement local.');
    return;
  }

  const payload = JSON.stringify({
    action: 'insert_task',
    id: task.id || ('task-' + Date.now()),
    timestamp: task.timestamp || new Date().toISOString(),
    uid: task.uid,
    cookies: task.cookies,
    firstName: task.firstName,
    lastName: task.lastName,
    password: task.password,
    telegramUserId: String(task.telegramUserId),
    telegramUsername: task.telegramUsername || 'utilisateur',
    status: task.status || 'compte créé',
    notes: task.notes || 'Enregistré via Taskify Pro Bot (@TaskifyProBot)',
    taskType: task.taskType || 'Facebook'
  });

  try {
    const url = new URL(GOOGLE_SHEET_WEBHOOK_URL);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      console.log('[Sheets Sync] ✅ Statut HTTP: ' + res.statusCode);
    });

    req.on('error', (e) => console.error('[Sheets Error]', e.message));
    req.write(payload);
    req.end();
  } catch (err) {
    console.error('[Sheets Exception]', err.message);
  }
}

// Helper Handlers
async function handleBalance(ctx) {
  const userFirstName = ctx.from?.first_name || 'Utilisateur';
  const userId = String(ctx.from?.id || 'unknown');
  sessions[userId] = { step: 'START' };

  await ctx.reply(
    '💰 *Votre Solde & Activité*\\n\\n' +
    '👤 Utilisateur : *' + userFirstName + '*\\n' +
    '🆔 ID Compte : \`' + userId + '\`\\n' +
    '🛡️ Statut : *Vérifié* ✅\\n\\n' +
    '💵 *Solde validé disponible :* \`0.00 €\`\\n' +
    '⏳ *En cours de validation :* \`0.00 €\`\\n' +
    '📊 *Tâches totales complétées :* \`0\`\\n' +
    '👥 *Filleuls enregistrés :* \`0\` (+0.00 €)\\n\\n' +
    '_Rémunération standard : 1.50 € par compte Facebook validé._',
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

async function handleTasks(ctx) {
  const userId = String(ctx.from?.id || 'unknown');
  sessions[userId] = { step: 'AUTH_CHOICE', taskType: 'Facebook' };

  await ctx.reply(
    '🌐 *Tâche : Création de Compte Facebook*\\n\\n' +
    '💵 Rémunération par compte validé : *1.50 €*\\n\\n' +
    'Choisissez votre méthode d\\'authentification pour cette tâche :\\n\\n' +
    '• 🍪 *Cookies* : Recommandé pour validation et enregistrement immédiat.\\n' +
    '• 🔐 *2FA* : Authentification par clé sécurisée.\\n\\n' +
    '_Sélectionnez votre option ci-dessous :_',
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🍪 Cookies (Recommandé)', 'auth_cookies'),
          Markup.button.callback('🔐 2FA', 'auth_2fa')
        ],
        [Markup.button.callback('ℹ️ Consignes & Règles', 'action_help')],
        [Markup.button.callback('❌ Annuler le processus', 'action_cancel')]
      ])
    }
  );
}

async function handleWithdrawal(ctx) {
  const userId = String(ctx.from?.id || 'unknown');
  sessions[userId] = { step: 'START' };

  await ctx.reply(
    '🏦 *Demande de Retrait de Gains*\\n\\n' +
    '💵 Solde disponible : *0.00 €*\\n' +
    '🎯 Seuil minimum de retrait : *10.00 €*\\n' +
    '🛡️ Statut : 🟡 *En attente du seuil (10.00 €)*\\n\\n' +
    'Moyens de paiement pris en charge :\\n' +
    '• 📱 *Mobile Money* (MVola, Orange Money, Airtel Money)\\n' +
    '• 🪙 *Crypto USDT* (TRC20 / BEP20 - 0 frais)\\n' +
    '• 💳 *Virement Bancaire SEPA*\\n\\n' +
    '_Complétez des tâches pour débloquer votre premier retrait._',
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

async function handleSupport(ctx) {
  const userId = String(ctx.from?.id || 'unknown');
  sessions[userId] = { step: 'START' };

  await ctx.reply(
    '📞 *Support & Assistance Opérateurs*\\n\\n' +
    'Une question technique, un blocage ou une demande de paiement ?\\n\\n' +
    '👤 *Administrateur Support :* @TaskifySupport\\n' +
    '📢 *Canal Officiel :* @TaskifyAnnouncements\\n' +
    '⏰ *Horaires :* 7j/7 — 08h00 à 22h00 (UTC+1)\\n' +
    '⚡ *Délai moyen de réponse :* < 15 minutes\\n\\n' +
    '_Cliquez sur le bouton ci-dessous pour ouvrir directement la conversation :_',
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [Markup.button.url('💬 Ouvrir le Support Telegram', 'https://t.me/TaskifySupport')],
        [Markup.button.callback('❓ FAQ & Questions Fréquentes', 'action_help')]
      ])
    }
  );
}

async function handleReferral(ctx) {
  const userId = String(ctx.from?.id || '000000');
  const refLink = 'https://t.me/TaskifyProBot?start=ref_' + userId;
  sessions[userId] = { step: 'START' };

  await ctx.reply(
    '👥 *Programme de Parrainage ' + PLATFORM_NAME + '*\\n\\n' +
    'Invitez d\\'autres opérateurs et gagnez des commissions automatiques !\\n\\n' +
    '💎 *Gains par tâche validée par un filleul :* \`+0.25 €\`\\n' +
    '📊 *Nombre de filleuls actifs :* \`0\`\\n' +
    '💵 *Total des commissions perçues :* \`0.00 €\`\\n\\n' +
    '🔗 *Votre lien de parrainage unique :*\\n' +
    '\`' + refLink + '\`\\n\\n' +
    '_Partagez ce lien à vos connaissances pour commencer à accumuler des revenus passifs._',
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [Markup.button.url('📤 Partager mon lien', 'https://t.me/share/url?url=' + encodeURIComponent(refLink) + '&text=' + encodeURIComponent("Rejoins Taskify Pro pour gagner de l'argent !"))]
      ])
    }
  );
}

async function handleLeaderboard(ctx) {
  const userId = String(ctx.from?.id || 'unknown');
  sessions[userId] = { step: 'START' };

  await ctx.reply(
    '🏆 *Classement des Meilleurs Opérateurs (Ce Mois)*\\n\\n' +
    '1. 🥇 Opérateur #9482 — \`428 tâches\` (Prime +50.00 €)\\n' +
    '2. 🥈 Opérateur #1092 — \`391 tâches\` (Prime +30.00 €)\\n' +
    '3. 🥉 Opérateur #7401 — \`315 tâches\` (Prime +15.00 €)\\n' +
    '4. ⭐ Opérateur #5892 — \`280 tâches\`\\n' +
    '5. ⭐ Opérateur #3419 — \`204 tâches\`\\n\\n' +
    '━━━━━━━━━━━━━━━━━━\\n' +
    '📍 *Votre Position :* \`Top 15%\`\\n' +
    '📊 *Vos Tâches :* \`0 validées\`\\n\\n' +
    '_Primes versées automatiquement chaque 1er du mois aux 3 premiers du classement._',
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Faire des tâches pour grimper', 'task_facebook')]
      ])
    }
  );
}

async function handleLanguage(ctx) {
  const userId = String(ctx.from?.id || 'unknown');
  sessions[userId] = { step: 'START' };

  await ctx.reply(
    '🪩 *Sélection de la Langue / Language / Fiteny*\\n\\n' +
    'Langue active : 🇫🇷 *Français*\\n\\n' +
    'Choisissez votre langue de préférence ci-dessous :',
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🇫🇷 Français', 'lang_fr'),
          Markup.button.callback('🇲🇬 Malagasy', 'lang_mg'),
          Markup.button.callback('🇬🇧 English', 'lang_en')
        ]
      ])
    }
  );
}

// 1. /start command
bot.start(async (ctx) => {
  const userId = String(ctx.from?.id || 'unknown');
  const userFirstName = ctx.from?.first_name || 'utilisateur';
  sessions[userId] = { step: 'START' };

  await ctx.reply(
    '👋 *Bienvenue sur ' + PLATFORM_NAME + ' (@TaskifyProBot) !*\\n\\n' +
    'Bonjour *' + userFirstName + '*,\\n' +
    'Utilisez le menu principal ci-dessous pour gérer vos tâches ou consulter votre solde.\\n\\n' +
    '👉 Cliquez sur *📋 Tâches* pour débuter la création d\\'un compte.',
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD
    }
  );
});

// Menu listeners
bot.hears(['💰 Solde', '💰 Solde / Gains', 'Solde', 'solde', '/balance', '/solde'], handleBalance);
bot.hears(['📋 Tâches', '📋 Taches', 'Tâches', 'Taches', '🌐 Démarrer tâche Facebook', '🌐 Démarrer tâche', 'Démarrer tâche Facebook', 'Démarrer tâche', '/tasks', '/taches', '/task'], handleTasks);
bot.hears(['🏦 Retrait', '🏦 Demander Retrait', 'Retrait', 'retrait', '/withdraw', '/retrait'], handleWithdrawal);
bot.hears(['📞 Support', '📞 Assistance', 'Support', 'support', 'Assistance', '/support'], handleSupport);
bot.hears(['👥 Parrainages', '👥 Parrainage', 'Parrainages', 'Parrainage', '/referral', '/parrainage'], handleReferral);
bot.hears(['🏆 Classement', '🏆 Top Opérateurs', 'Classement', 'classement', '/leaderboard', '/top'], handleLeaderboard);
bot.hears(['🪩 Langue', '🪩 Langues', 'Langue', 'langue', 'Language', '/language', '/langue'], handleLanguage);

bot.action('lang_fr', async (ctx) => {
  await ctx.answerCbQuery('Langue : Français');
  await ctx.reply('✅ Langue configurée en **Français**.', { parse_mode: 'Markdown' });
});

bot.action('lang_en', async (ctx) => {
  await ctx.answerCbQuery('Language: English');
  await ctx.reply('🌐 Language updated to English.', { parse_mode: 'Markdown' });
});

// 2. Facebook task choice -> ask Cookies vs 2FA
bot.action('task_facebook', async (ctx) => {
  const userId = String(ctx.from.id);
  sessions[userId] = { step: 'AUTH_CHOICE', taskType: 'Facebook' };

  await ctx.answerCbQuery();
  await ctx.reply(
    '🌐 *Tâche : Facebook*\\n\\n' +
    'Choisissez votre méthode d\\'authentification :\\n\\n' +
    '• 🍪 *Cookies* : Recommandé pour validation immédiate.\\n' +
    '• 🔐 *2FA* : Authentification par code.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🍪 Cookies', 'auth_cookies'),
          Markup.button.callback('🔐 2FA', 'auth_2fa')
        ],
        [Markup.button.callback('❌ Annuler', 'action_cancel')]
      ])
    }
  );
});

// 2FA Notice
bot.action('auth_2fa', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '⚠️ *Authentification 2FA non disponible*\\n\\n' +
    'L\\'option 2FA est suspendue. Veuillez obligatoirement utiliser la méthode *Cookies*.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🍪 Choisir Cookies', 'auth_cookies')],
        [Markup.button.callback('❌ Annuler le processus', 'action_cancel')]
      ])
    }
  );
});

// 3. Cookies Choice -> Generate Name & Show dynamic Password
bot.action('auth_cookies', async (ctx) => {
  const userId = String(ctx.from.id);
  const identity = getRandomIdentity();

  sessions[userId] = {
    step: 'CREDENTIALS_SHOWN',
    firstName: identity.firstName,
    lastName: identity.lastName,
    password: DEFAULT_BOT_PASSWORD,
    taskType: 'Facebook'
  };

  await ctx.answerCbQuery();
  await ctx.reply(
    '⚠️ *Informations du compte Facebook*\\n\\n' +
    '✅ Prénom : \`' + identity.firstName + '\`\\n' +
    '✅ Nom : \`' + identity.lastName + '\`\\n' +
    '🇫🇷 Mot de passe : \`' + DEFAULT_BOT_PASSWORD + '\`\\n\\n' +
    '🔻 Une fois le compte créé, envoyez votre UID.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📥 Envoyer l\\'UID', 'action_send_uid')],
        [Markup.button.callback('🔙 Retour', 'task_facebook')],
        [Markup.button.callback('❌ Annuler le processus', 'action_cancel')]
      ])
    }
  );
});

// 4. Prompt UID step
bot.action('action_send_uid', async (ctx) => {
  const userId = String(ctx.from.id);
  if (!sessions[userId]) sessions[userId] = { taskType: 'Facebook' };
  sessions[userId].step = 'AWAITING_UID';

  await ctx.answerCbQuery();
  await ctx.reply(
    '✍️ *Étape 1/2 : Envoi de l\\'UID Facebook*\\n\\n' +
    'Veuillez envoyer votre **UID Facebook** (ex: \`100084928172910\`) :',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Annulation processus', 'action_cancel')]
      ])
    }
  );
});

// Cancel Handler
bot.action('action_cancel', async (ctx) => {
  const userId = String(ctx.from.id);
  delete sessions[userId];

  await ctx.answerCbQuery();
  await ctx.reply(
    '❌ *Processus annulé.*\\n\\nAucune donnée n\\'a été enregistrée.',
    {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Démarrer une tâche', 'task_facebook')]
      ])
    }
  );
});

// Help Handler
bot.action('action_help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '📌 *Guide d\\'utilisation*\\n\\n' +
    '1. Cliquez sur [ 📋 Tâches ] puis sélectionnez 🌐 Facebook.\\n' +
    '2. Choisissez Cookies pour obtenir votre nom et mot de passe générés.\\n' +
    '3. Transmettez votre UID et vos cookies pour enregistrement instantané.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🌐 Démarrer Facebook', 'task_facebook')]
      ])
    }
  );
});

// Text message interceptor
bot.on('text', async (ctx) => {
  const userId = String(ctx.from.id);
  const username = ctx.from?.username || ctx.from?.first_name || 'utilisateur';
  const text = ctx.message.text.trim();
  const lowerText = text.toLowerCase();
  const session = sessions[userId];

  // Instant Priority Dispatch for Persistent Keyboard Buttons
  if (text.includes('Solde') || lowerText === 'solde' || lowerText === '/solde' || lowerText === '/balance') {
    return handleBalance(ctx);
  }
  if (text.includes('Tâches') || text.includes('Taches') || text.includes('Démarrer tâche') || lowerText === 'taches' || lowerText === 'tâches' || lowerText === '/tasks' || lowerText === '/taches') {
    return handleTasks(ctx);
  }
  if (text.includes('Retrait') || lowerText === 'retrait' || lowerText === '/withdraw' || lowerText === '/retrait') {
    return handleWithdrawal(ctx);
  }
  if (text.includes('Support') || text.includes('Assistance') || lowerText === 'support' || lowerText === '/support') {
    return handleSupport(ctx);
  }
  if (text.includes('Parrainage') || text.includes('Parrainages') || lowerText === 'parrainage' || lowerText === '/referral') {
    return handleReferral(ctx);
  }
  if (text.includes('Classement') || lowerText === 'classement' || lowerText === '/leaderboard' || lowerText === '/top') {
    return handleLeaderboard(ctx);
  }
  if (text.includes('Langue') || text.includes('Langues') || lowerText === 'langue' || lowerText === 'language' || lowerText === '/language') {
    return handleLanguage(ctx);
  }

  if (!session || !session.step || session.step === 'START') {
    return ctx.reply('👋 Bonjour ! Utilisez le menu principal ci-dessous ou tapez /start pour commencer.', {
      parse_mode: 'Markdown',
      ...MAIN_REPLY_KEYBOARD,
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Démarrer une Tâche Facebook', 'task_facebook')]
      ])
    });
  }

  if (session.step === 'AWAITING_UID') {
    session.uid = text;
    session.step = 'AWAITING_COOKIES';

    await ctx.reply(
      '✅ *UID enregistré :* \`' + text + '\`\\n\\n' +
      '🍪 *Étape 2/2 : Envoi des Cookies*\\n\\n' +
      'Veuillez maintenant coller vos **Cookies Facebook** :',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Annulation processus', 'action_cancel')]
        ])
      }
    );
    return;
  }

  if (session.step === 'AWAITING_COOKIES') {
    session.cookies = text;

    const taskRecord = {
      id: 'task-' + Date.now(),
      uid: session.uid || 'Non fourni',
      cookies: session.cookies,
      firstName: session.firstName || 'Généré',
      lastName: session.lastName || 'Auto',
      password: session.password || DEFAULT_BOT_PASSWORD,
      telegramUserId: userId,
      telegramUsername: username,
      status: 'compte créé',
      timestamp: new Date().toISOString(),
      taskType: session.taskType || 'Facebook'
    };

    delete sessions[userId];
    syncToGoogleSheets(taskRecord);

    await ctx.reply(
      '🎉 *Tâche terminée avec succès !*\\n\\n' +
      '✅ Vos informations ont été enregistrées avec succès.\\n\\n' +
      '🆔 *UID :* \`' + taskRecord.uid + '\`\\n' +
      '👤 *Nom complet :* ' + taskRecord.firstName + ' ' + taskRecord.lastName + '\\n' +
      '🔑 *Mot de passe :* \`' + taskRecord.password + '\`\\n\\n' +
      'Merci pour votre travail !',
      {
        parse_mode: 'Markdown',
        ...MAIN_REPLY_KEYBOARD,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Nouvelle Tâche Facebook', 'task_facebook')]
        ])
      }
    );
  }
});

// Error handling
bot.catch((err) => {
  console.error('[Telegraf Error]', err);
});

// Health check server for Render
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', bot: 'Taskify Pro' }));
});

server.listen(PORT, () => {
  console.log('[HTTP Server] Port ' + PORT + ' actif.');
});

bot.launch().then(() => {
  console.log('🤖 Taskify Pro Bot démarré avec succès en mode Polling.');
});

process.once('SIGINT', () => { bot.stop('SIGINT'); server.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); server.close(); });
`,

  googleAppsScript: `/**
 * Google Apps Script - Webhook Backend pour Google Sheets
 * Base de Données 100% GRATUITE A VIE sans carte bancaire
 * 
 * INSTRUCTIONS :
 * 1. Ouvrez Google Sheets -> Extensions -> Apps Script
 * 2. Collez ce code complet dans Code.gs
 * 3. Cliquez sur Déployer -> Nouveau déploiement -> Type : Application Web
 * 4. "Exécuter en tant que" : Moi
 * 5. "Qui a accès" : Tout le monde (Anyone)
 * 6. Copiez l'URL Web (/exec) et collez-la dans les Paramètres du Dashboard Taskify Pro !
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Initialise les colonnes si la feuille est vide
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "ID",
        "Horodatage",
        "UID Facebook",
        "Prénom",
        "Nom",
        "Mot de passe",
        "Cookies",
        "Statut",
        "Telegram User ID",
        "Telegram Username",
        "Notes",
        "Type de Tâche"
      ]);
      
      // Style d'en-tête professionnel
      var headerRange = sheet.getRange(1, 1, 1, 12);
      headerRange.setBackground("#1e293b");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
    }

    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    }

    var row = [
      data.id || ("task-" + new Date().getTime()),
      data.timestamp || new Date().toISOString(),
      "'" + (data.uid || "N/A"),
      data.firstName || "",
      data.lastName || "",
      data.password || "",
      data.cookies || "",
      data.status || "compte créé",
      "'" + (data.telegramUserId || ""),
      "@" + (data.telegramUsername || "").replace("@", ""),
      data.notes || "",
      data.taskType || "Facebook"
    ];

    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Ligne insérée avec succès dans Google Sheets",
      row: row
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    platform: "Taskify Pro",
    bot: "@TaskifyProBot",
    message: "Google Apps Script Webhook opérationnel !"
  })).setMimeType(ContentService.MimeType.JSON);
}
`,

  packageJson: `{
  "name": "taskify-pro-bot",
  "version": "1.0.0",
  "description": "Telegram Bot & Google Sheets Task Management System for @TaskifyProBot",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "telegraf": "^4.16.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`,

  envExample: `# Configuration Telegram & Google Sheets - Taskify Pro (@TaskifyProBot)
TELEGRAM_BOT_TOKEN="VOTRE_TOKEN_BOTFATHER_ICI"
GOOGLE_SHEET_WEBHOOK_URL="https://script.google.com/macros/s/VOTRE_ID_APP_SCRIPT/exec"
DEFAULT_BOT_PASSWORD="TaskPassword@2025!"
PLATFORM_NAME="Taskify Pro"
`,

  readme: `# Taskify Pro (@TaskifyProBot) - Telegram Bot & Web Dashboard System

100% FREE Hosting on Render, Railway or Vercel with Google Sheets Database.

## Quick Start:
1. \`npm install\`
2. Configurer \`.env\`
3. \`node bot.js\`
`
};
