import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Telegraf, Markup } from 'telegraf';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ----------------------------------------------------
// IN-MEMORY DATABASE & CONFIG STATE
// ----------------------------------------------------
const FIRST_NAMES = [
  'Alexandre', 'Thomas', 'Julien', 'Nicolas', 'Maxime', 'Lucas', 'Antoine', 'Romain',
  'Guillaume', 'Clément', 'Hugo', 'Valentin', 'Mathieu', 'Florian', 'Adrien', 'Quentin',
  'Benjamin', 'Pierre', 'Louis', 'Arthur', 'Paul', 'Théo', 'Baptiste', 'Gabriel',
  'Camille', 'Emma', 'Léa', 'Chloé', 'Manon', 'Inès', 'Sarah', 'Laura',
  'Marine', 'Juliette', 'Lucie', 'Clara', 'Marie', 'Anaïs', 'Pauline', 'Océane'
];

const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand',
  'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David',
  'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'Andre', 'Lefevre',
  'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'Francois', 'Martinez', 'Legrand', 'Garnier',
  'Faure', 'Rousseau', 'Blanc', 'Guerin', 'Muller', 'Henry', 'Roussel', 'Nicolas'
];

function generateRandomName() {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return { firstName, lastName };
}

let botSettings = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  customPassword: process.env.DEFAULT_BOT_PASSWORD || 'TaskPassword@2025!',
  googleSheetWebhookUrl: process.env.GOOGLE_SHEET_WEBHOOK_URL || '',
  platformName: process.env.PLATFORM_NAME || 'Taskify Pro',
  isBotActive: false,
  mode: 'polling' as 'polling' | 'webhook',
  webhookUrl: process.env.WEBHOOK_URL || '',
  lastSyncedAt: new Date().toISOString(),
  welcomeMessage: "Bienvenue sur Taskify Pro (@TaskifyProBot) - Gestionnaire de tâches automatisées."
};

let tasks: any[] = [];

let logs: any[] = [];

function addLog(type: 'info' | 'success' | 'warning' | 'error', source: 'telegram' | 'sheets' | 'system' | 'simulator', message: string, data?: any) {
  const newLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    type,
    source,
    message,
    data
  };
  logs.unshift(newLog);
  if (logs.length > 200) logs.pop();
  return newLog;
}

// User active session state for bot flow (in-memory per telegram/sim user)
const userSessions: Record<string, {
  step: string;
  taskType?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  uid?: string;
  cookies?: string;
}> = {};

// Helper: Dispatch task record to Google Apps Script Webhook
async function syncRowToGoogleSheets(task: any): Promise<{ success: boolean; message: string; statusCode?: number }> {
  const webhookUrl = botSettings.googleSheetWebhookUrl || process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    console.log(`[Google Sheets] ℹ️ Webhook URL non configurée. Enregistrement local uniquement (UID: ${task.uid})`);
    return { success: false, message: 'Google Sheet Webhook URL not configured' };
  }

  try {
    const payload = {
      action: 'insert_task',
      id: task.id || `task-${Date.now()}`,
      timestamp: task.createdAt || task.timestamp || new Date().toISOString(),
      uid: task.uid,
      cookies: task.cookies,
      firstName: task.firstName,
      lastName: task.lastName,
      password: task.password,
      telegramUserId: String(task.telegramUserId),
      telegramUsername: task.telegramUsername || 'utilisateur',
      status: task.status || 'compte créé',
      notes: task.notes || `Enregistré via ${botSettings.platformName || 'Taskify Pro'} (@TaskifyProBot)`,
      taskType: task.taskType || 'Facebook'
    };

    console.log(`[Google Sheets] 📡 Transmission des données vers Google Sheets Webhook (UID: ${task.uid})...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(webhookUrl, {
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
      console.log(`[Google Sheets] ✅ Synchronisation réussie pour UID ${task.uid} (HTTP ${response.status}) -> ${responseText.slice(0, 150)}`);
      addLog('success', 'sheets', `Données synchronisées avec Google Sheets pour UID: ${task.uid} (HTTP ${response.status})`);
      return { success: true, message: responseText || 'OK', statusCode: response.status };
    } else {
      console.error(`[Google Sheets] ⚠️ Réponse non-200 du Webhook pour UID ${task.uid} (HTTP ${response.status}) -> ${responseText.slice(0, 200)}`);
      addLog('warning', 'sheets', `Webhook Google Sheets a répondu HTTP ${response.status} pour UID: ${task.uid}`);
      return { success: false, message: responseText || `HTTP ${response.status}`, statusCode: response.status };
    }
  } catch (error: any) {
    const errorMsg = error.name === 'AbortError' ? 'Délai d\'attente dépassé (Timeout 15s)' : error.message;
    console.error(`[Google Sheets] ❌ Échec synchronisation Google Sheets pour UID ${task.uid}:`, errorMsg);
    addLog('error', 'sheets', `Échec synchronisation Google Sheets: ${errorMsg}`);
    return { success: false, message: errorMsg };
  }
}

// ----------------------------------------------------
// LIVE TELEGRAM BOT INSTANCE (OPTIONAL REAL LAUNCH)
// ----------------------------------------------------
let activeTelegrafBot: Telegraf | null = null;

// Persistent Reply Keyboard (Menu Principal)
const MAIN_REPLY_KEYBOARD = Markup.keyboard([
  ['💰 Solde', '📋 Tâches'],
  ['🏦 Retrait', '📞 Support'],
  ['👥 Parrainages', '🏆 Classement'],
  ['🪩 Langue']
]).resize();

function setupTelegrafHandlers(bot: Telegraf) {
  // Helper for clean, seamless in-place editing (preventing message spanning in chat history)
  const renderScreen = async (ctx: any, text: string, extra: any = {}) => {
    try {
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        return await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          ...extra
        });
      }
    } catch (err: any) {
      if (!err.message?.includes('message is not modified')) {
        console.warn('[Telegraf UI Render] Fallback to reply:', err.message);
      } else {
        return;
      }
    }
    return await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...extra
    });
  };
  // /start command
  bot.start(async (ctx) => {
    const userId = String(ctx.from?.id || 'unknown');
    const userFirstName = ctx.from?.first_name || 'utilisateur';
    userSessions[userId] = { step: 'START' };

    await ctx.reply(
      `👋 *Bienvenue sur ${botSettings.platformName} (@TaskifyProBot) !*\n\n` +
      `Bonjour *${userFirstName}*,\n` +
      `Utilisez le menu ci-dessous pour gérer vos tâches ou suivre votre activité.\n\n` +
      `👉 Cliquez sur *📋 Tâches* pour débuter la création d'un compte.`,
      {
        parse_mode: 'Markdown',
        ...MAIN_REPLY_KEYBOARD
      }
    );
  });

  // ----------------------------------------------------
  // TELEGRAM BOT PERSISTENT MENU HANDLERS
  // ----------------------------------------------------

  // Helper: Handle 💰 Solde
  const handleBalance = async (ctx: any) => {
    const userFirstName = ctx.from?.first_name || 'Utilisateur';
    const userId = String(ctx.from?.id || 'unknown');
    userSessions[userId] = { step: 'START' };

    await ctx.reply(
      `💰 *Votre Solde & Activité*\n\n` +
      `👤 Utilisateur : *${userFirstName}*\n` +
      `🆔 ID Compte : \`${userId}\`\n` +
      `🛡️ Statut : *Vérifié* ✅\n\n` +
      `💵 *Solde validé disponible :* \`0.00 €\`\n` +
      `⏳ *En cours de validation :* \`0.00 €\`\n` +
      `📊 *Tâches totales complétées :* \`0\`\n` +
      `👥 *Filleuls enregistrés :* \`0\` (+0.00 €)\n\n` +
      `_Rémunération standard : 1.50 € par compte Facebook validé._`,
      {
        parse_mode: 'Markdown',
        ...MAIN_REPLY_KEYBOARD,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📋 Effectuer une Tâche', 'task_facebook')],
          [Markup.button.callback('🏦 Demander un Retrait', 'action_request_withdrawal')]
        ])
      }
    );
  };

  // Helper: Handle 📋 Tâches / 🌐 Démarrer tâche Facebook
  const handleTasks = async (ctx: any) => {
    const userId = String(ctx.from?.id || 'unknown');
    userSessions[userId] = { step: 'AUTH_CHOICE', taskType: 'Facebook' };

    await ctx.reply(
      `🌐 *Tâche : Création de Compte Facebook*\n\n` +
      `💵 Rémunération par compte validé : *1.50 €*\n\n` +
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
  };

  // Helper: Handle 🏦 Retrait
  const handleWithdrawal = async (ctx: any) => {
    const userId = String(ctx.from?.id || 'unknown');
    userSessions[userId] = { step: 'START' };

    await ctx.reply(
      `🏦 *Demande de Retrait de Gains*\n\n` +
      `💵 Solde disponible : *0.00 €*\n` +
      `🎯 Seuil minimum de retrait : *10.00 €*\n` +
      `🛡️ Statut : 🟡 *En attente du seuil (10.00 €)*\n\n` +
      `Moyens de paiement pris en charge :\n` +
      `• 📱 *Mobile Money* (MVola, Orange Money, Airtel Money)\n` +
      `• 🪙 *Crypto USDT* (TRC20 / BEP20 - 0 frais)\n` +
      `• 💳 *Virement Bancaire SEPA*\n\n` +
      `_Complétez des tâches pour débloquer votre premier retrait._`,
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
  };

  // Helper: Handle 📞 Support
  const handleSupport = async (ctx: any) => {
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
  };

  // Helper: Handle 👥 Parrainages
  const handleReferral = async (ctx: any) => {
    const userId = String(ctx.from?.id || '000000');
    const refLink = `https://t.me/TaskifyProBot?start=ref_${userId}`;
    userSessions[userId] = { step: 'START' };

    await ctx.reply(
      `👥 *Programme de Parrainage ${botSettings.platformName}*\n\n` +
      `Invitez d'autres opérateurs et gagnez des commissions automatiques !\n\n` +
      `💎 *Gains par tâche validée par un filleul :* \`+0.25 €\`\n` +
      `📊 *Nombre de filleuls actifs :* \`0\`\n` +
      `💵 *Total des commissions perçues :* \`0.00 €\`\n\n` +
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
  };

  // Helper: Handle 🏆 Classement
  const handleLeaderboard = async (ctx: any) => {
    const userId = String(ctx.from?.id || 'unknown');
    userSessions[userId] = { step: 'START' };

    await ctx.reply(
      `🏆 *Classement des Meilleurs Opérateurs (Ce Mois)*\n\n` +
      `1. 🥇 Opérateur #9482 — \`428 tâches\` (Prime +50.00 €)\n` +
      `2. 🥈 Opérateur #1092 — \`391 tâches\` (Prime +30.00 €)\n` +
      `3. 🥉 Opérateur #7401 — \`315 tâches\` (Prime +15.00 €)\n` +
      `4. ⭐ Opérateur #5892 — \`280 tâches\`\n` +
      `5. ⭐ Opérateur #3419 — \`204 tâches\`\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📍 *Votre Position :* \`Top 15%\`\n` +
      `📊 *Vos Tâches :* \`0 validées\`\n\n` +
      `_Primes versées automatiquement chaque 1er du mois aux 3 premiers du classement._`,
      {
        parse_mode: 'Markdown',
        ...MAIN_REPLY_KEYBOARD,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Faire des tâches pour grimper', 'task_facebook')]
        ])
      }
    );
  };

  // Helper: Handle 🪩 Langue
  const handleLanguage = async (ctx: any) => {
    const userId = String(ctx.from?.id || 'unknown');
    userSessions[userId] = { step: 'START' };

    await ctx.reply(
      `🪩 *Sélection de la Langue / Language / Fiteny*\n\n` +
      `Langue active : 🇫🇷 *Français*\n\n` +
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
  };

  // 1. 💰 Solde
  bot.hears(['💰 Solde', '💰 Solde / Gains', 'Solde', 'solde', '/balance', '/solde'], handleBalance);

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
  ], handleTasks);

  // 3. 🏦 Retrait
  bot.hears(['🏦 Retrait', '🏦 Demander Retrait', 'Retrait', 'retrait', '/withdraw', '/retrait'], handleWithdrawal);

  // 4. 📞 Support
  bot.hears(['📞 Support', '📞 Assistance', 'Support', 'support', 'Assistance', '/support'], handleSupport);

  // 5. 👥 Parrainages
  bot.hears(['👥 Parrainages', '👥 Parrainage', 'Parrainages', 'Parrainage', '/referral', '/parrainage'], handleReferral);

  // 6. 🏆 Classement
  bot.hears(['🏆 Classement', '🏆 Top Opérateurs', 'Classement', 'classement', '/leaderboard', '/top'], handleLeaderboard);

  // 7. 🪩 Langue
  bot.hears(['🪩 Langue', '🪩 Langues', 'Langue', 'langue', 'Language', '/language', '/langue'], handleLanguage);

  bot.action(['lang_fr', 'set_lang_fr'], async (ctx) => {
    await ctx.answerCbQuery('Langue : Français');
    await renderScreen(ctx, '✅ Langue configurée en **Français**.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 Voir les Tâches', 'task_facebook')],
        [Markup.button.callback('💰 Consulter mon Solde', 'action_check_balance')]
      ])
    });
  });

  bot.action(['lang_mg', 'set_lang_mg'], async (ctx) => {
    await ctx.answerCbQuery('Fiteny : Malagasy');
    await renderScreen(ctx, '✅ Voafaritra amin\'ny teny **Malagasy** ny bot.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 Hanao Asa (Tâches)', 'task_facebook')],
        [Markup.button.callback('💰 Hijery Solde', 'action_check_balance')]
      ])
    });
  });

  bot.action(['lang_en', 'set_lang_en'], async (ctx) => {
    await ctx.answerCbQuery('Language: English');
    await renderScreen(ctx, '🌐 Language updated to **English**.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 View Tasks', 'task_facebook')],
        [Markup.button.callback('💰 Check Balance', 'action_check_balance')]
      ])
    });
  });

  // Retrait Sub-actions
  bot.action('withdraw_mobile_money', async (ctx) => {
    await ctx.answerCbQuery();
    await renderScreen(
      ctx,
      `📱 *Retrait Mobile Money (MVola, Orange Money, Airtel Money)*\n\n` +
      `Le montant minimum de retrait est de *10.00 €*.\n` +
      `Pour soumettre une demande manuelle immédiate, écrivez au support : @TaskifySupport`,
      Markup.inlineKeyboard([
        [Markup.button.url('💬 Contacter le Support', 'https://t.me/TaskifySupport')],
        [Markup.button.callback('🔙 Retour', 'action_cancel')]
      ])
    );
  });

  bot.action('withdraw_crypto', async (ctx) => {
    await ctx.answerCbQuery();
    await renderScreen(
      ctx,
      `🪙 *Retrait Crypto USDT (TRC20 / BEP20)*\n\n` +
      `Frais de réseau : 0 € (Pris en charge).\n` +
      `Transmettez votre adresse USDT directement à l'administrateur : @TaskifySupport`,
      Markup.inlineKeyboard([
        [Markup.button.url('💬 Contacter le Support', 'https://t.me/TaskifySupport')],
        [Markup.button.callback('🔙 Retour', 'action_cancel')]
      ])
    );
  });

  bot.action('withdraw_bank', async (ctx) => {
    await ctx.answerCbQuery();
    await renderScreen(
      ctx,
      `💳 *Virement Bancaire (SEPA)*\n\n` +
      `Délai de traitement : 24h à 48h ouvrées.\n` +
      `Transmettez vos coordonnées bancaires (IBAN/BIC) à @TaskifySupport`,
      Markup.inlineKeyboard([
        [Markup.button.url('💬 Contacter le Support', 'https://t.me/TaskifySupport')],
        [Markup.button.callback('🔙 Retour', 'action_cancel')]
      ])
    );
  });

  bot.action('action_faq', async (ctx) => {
    await ctx.answerCbQuery();
    await renderScreen(
      ctx,
      `❓ *FAQ & Questions Fréquentes*\n\n` +
      `• *Quand mes tâches sont-elles validées ?*\n` +
      `Instantanément dès réception de l'UID et des cookies complets.\n\n` +
      `• *Quand puis-je retirer ?*\n` +
      `Dès que vous atteignez le seuil de 10.00 €.\n\n` +
      `• *Besoin d'aide ?* Écrivez à @TaskifySupport`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Démarrer une Tâche', 'task_facebook')]
      ])
    );
  });

  bot.action('action_task_rules', async (ctx) => {
    await ctx.answerCbQuery();
    await renderScreen(
      ctx,
      `📋 *Règles de Création Facebook*\n\n` +
      `1. Utilisez le nom français et mot de passe attribués.\n` +
      `2. Exportez les cookies complets au format standard.\n` +
      `3. Ne réutilisez pas le même UID deux fois.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Compris, démarrer', 'task_facebook')]
      ])
    );
  });

  bot.action('task_help', async (ctx) => {
    await ctx.answerCbQuery();
    await renderScreen(
      ctx,
      `📌 *${botSettings.platformName} (@TaskifyProBot) - Aide*\n\n` +
      `Ce bot permet d'automatiser la collecte et l'enregistrement sécurisé des comptes de travail.\n\n` +
      `1. Cliquez sur "📋 Tâches" puis "🌐 Facebook".\n` +
      `2. Choisissez l'option "Cookies" pour générer une identité française.\n` +
      `3. Cliquez sur "📤 Envoie UID", transmettez votre UID puis collez vos cookies.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🌐 Démarrer Facebook', 'task_facebook')]
      ])
    );
  });

  bot.action('task_facebook', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id || 'unknown');
    userSessions[userId] = { step: 'AUTH_CHOICE', taskType: 'Facebook' };

    await renderScreen(
      ctx,
      `🌐 *Tâche : Facebook*\n\nChoisissez votre méthode d'authentification :`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🍪 Cookies', 'auth_cookies')],
        [Markup.button.callback('🔐 2FA', 'auth_2fa')],
        [Markup.button.callback('❌ Annuler', 'action_cancel')]
      ])
    );
  });

  bot.action('auth_2fa', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id || 'unknown');
    userSessions[userId] = { step: 'START' };

    await renderScreen(
      ctx,
      `⚠️ *Authentification 2FA non disponible*\n\nLa méthode 2FA n'est pas acceptée pour cette tâche. Veuillez utiliser la méthode par *Cookies*.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🍪 Choisir Cookies', 'auth_cookies')],
        [Markup.button.callback('❌ Annuler le processus', 'action_cancel')]
      ])
    );
  });

  bot.action('auth_cookies', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id || 'unknown');
    const { firstName, lastName } = generateRandomName();
    const currentPassword = botSettings.customPassword || 'TaskPassword@2025!';

    userSessions[userId] = {
      step: 'CREDENTIALS_SHOWN',
      taskType: 'Facebook',
      firstName,
      lastName,
      password: currentPassword
    };

    await renderScreen(
      ctx,
      `⚠️ *Informations du compte Facebook*\n\n` +
      `✅ Prénom : \`${firstName}\`\n` +
      `✅ Nom : \`${lastName}\`\n` +
      `🇫🇷 Mot de passe : \`${currentPassword}\`\n\n` +
      `🔻 Une fois le compte créé, envoyez votre UID.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('📥 Envoyer l\'UID', 'action_send_uid')],
        [Markup.button.callback('🔙 Retour', 'task_facebook')],
        [Markup.button.callback('❌ Annuler le processus', 'action_cancel')]
      ])
    );
  });

  bot.action('action_send_uid', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id || 'unknown');
    if (!userSessions[userId]) {
      userSessions[userId] = { step: 'AWAITING_UID' };
    } else {
      userSessions[userId].step = 'AWAITING_UID';
    }

    await renderScreen(
      ctx,
      `✍️ *Étape 1/2 : Envoi de l'UID*\n\nVeuillez coller et envoyer votre **UID Facebook** (ex: \`100098472910\`) :`,
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Annulation processus', 'action_cancel')]
      ])
    );
  });

  bot.action('action_check_balance', async (ctx) => {
    await ctx.answerCbQuery();
    const userFirstName = ctx.from?.first_name || 'Utilisateur';
    const userId = String(ctx.from?.id || 'unknown');
    await renderScreen(
      ctx,
      `💰 *Votre Solde Actuel :* \`0.00 €\`\n` +
      `👤 *Utilisateur :* ${userFirstName} (ID: \`${userId}\`)\n` +
      `📊 *Tâches complétées :* \`0\`\n` +
      `⏳ *En attente :* \`0.00 €\``,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Nouvelle Tâche Facebook', 'task_facebook')],
        [Markup.button.callback('🏦 Demander un Retrait', 'withdraw_mobile_money')]
      ])
    );
  });

  bot.action('action_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id || 'unknown');
    delete userSessions[userId];

    await renderScreen(
      ctx,
      `❌ *Processus annulé.*\n\nAucune donnée n'a été enregistrée. Utilisez le menu ci-dessous ou cliquez pour recommencer :`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Démarrer une tâche', 'task_facebook')]
      ])
    );
  });

  bot.on('text', async (ctx) => {
    const userId = String(ctx.from?.id || 'unknown');
    const username = ctx.from?.username || ctx.from?.first_name || 'utilisateur';
    const text = ctx.message.text.trim();
    const lowerText = text.toLowerCase();
    const session = userSessions[userId];

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
      return ctx.reply(
        `👋 Bonjour ! Utilisez le menu permanent ci-dessous ou cliquez sur [ 📋 Tâches ] pour commencer.`,
        {
          parse_mode: 'Markdown',
          ...MAIN_REPLY_KEYBOARD,
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Démarrer une Tâche Facebook', 'task_facebook')],
            [Markup.button.callback('💰 Voir mon Solde', 'action_check_balance')]
          ])
        }
      );
    }

    if (session.step === 'AWAITING_UID') {
      session.uid = text;
      session.step = 'AWAITING_COOKIES';

      await ctx.reply(
        `✅ *UID reçu avec succès :* \`${text}\`\n\n` +
        `🍪 *Étape 2/2 : Envoi des Cookies*\n\n` +
        `Veuillez maintenant coller vos **Cookies Facebook** (format texte ou JSON) :`,
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
      
      const newRecord = {
        id: `task-${Date.now()}`,
        uid: session.uid || 'Non fourni',
        cookies: session.cookies || '',
        firstName: session.firstName || 'Généré',
        lastName: session.lastName || 'Auto',
        password: session.password || botSettings.customPassword,
        telegramUserId: userId,
        telegramUsername: username,
        status: 'compte créé' as const,
        notes: 'Enregistré automatiquement via Telegram Bot',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncedToGoogleSheets: false,
        taskType: session.taskType || 'Facebook'
      };

      tasks.unshift(newRecord);
      addLog('success', 'telegram', `Tâche terminée pour @${username} (UID: ${newRecord.uid})`, newRecord);

      // Async sync to Google Sheets
      syncRowToGoogleSheets(newRecord).then(res => {
        if (res.success) {
          newRecord.syncedToGoogleSheets = true;
        }
      });

      // Clear session
      delete userSessions[userId];

      await ctx.reply(
        `🎉 *Tâche terminée avec succès !*\n\n` +
        `✅ *Vos informations ont été validées et sauvegardées.* \n\n` +
        `🆔 *UID :* \`${newRecord.uid}\`\n` +
        `👤 *Nom complet :* ${newRecord.firstName} ${newRecord.lastName}\n` +
        `🔑 *Mot de passe :* \`${newRecord.password}\`\n` +
        `📅 *Date :* ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}\n\n` +
        `Merci pour votre contribution !`,
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
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Tasks list
app.get('/api/tasks', (req, res) => {
  const { search, status, sort } = req.query;
  let result = [...tasks];

  if (status && status !== 'all') {
    result = result.filter(t => t.status === status);
  }

  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter(t => 
      t.uid.toLowerCase().includes(q) ||
      t.firstName.toLowerCase().includes(q) ||
      t.lastName.toLowerCase().includes(q) ||
      t.telegramUsername.toLowerCase().includes(q) ||
      t.telegramUserId.toLowerCase().includes(q)
    );
  }

  res.json(result);
});

// 3. Create task (manual or webhook)
app.post('/api/tasks', (req, res) => {
  const { uid, cookies, firstName, lastName, password, telegramUserId, telegramUsername, status, notes, taskType } = req.body;
  
  if (!uid) {
    return res.status(400).json({ error: 'UID is required' });
  }

  const generated = generateRandomName();
  const newTask = {
    id: `task-${Date.now()}`,
    uid: String(uid).trim(),
    cookies: String(cookies || '').trim(),
    firstName: firstName || generated.firstName,
    lastName: lastName || generated.lastName,
    password: password || botSettings.customPassword,
    telegramUserId: telegramUserId || 'manual_admin',
    telegramUsername: telegramUsername || 'admin_portal',
    status: (status || 'compte créé') as any,
    notes: notes || 'Ajouté manuellement depuis le Dashboard',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedToGoogleSheets: false,
    taskType: taskType || 'Facebook'
  };

  tasks.unshift(newTask);
  addLog('info', 'system', `Nouvelle tâche ajoutée manuellement (UID: ${newTask.uid})`);

  // Try sync
  if (botSettings.googleSheetWebhookUrl) {
    syncRowToGoogleSheets(newTask).then(r => {
      if (r.success) newTask.syncedToGoogleSheets = true;
    });
  }

  res.json(newTask);
});

// 4. Update task (status change: 'compte créé' <-> 'compte suspendu' <-> 'vérifié', notes)
app.patch('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const taskIndex = tasks.findIndex(t => t.id === id);
  if (taskIndex === -1) {
    return res.status(400).json({ error: 'Task not found' });
  }

  if (status) tasks[taskIndex].status = status;
  if (notes !== undefined) tasks[taskIndex].notes = notes;
  tasks[taskIndex].updatedAt = new Date().toISOString();

  addLog(
    status === 'compte suspendu' ? 'warning' : 'info',
    'system',
    `Statut mis à jour pour ${tasks[taskIndex].uid}: "${status || 'notes éditées'}"`
  );

  res.json(tasks[taskIndex]);
});

// 5. Delete task
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const task = tasks.find(t => t.id === id);
  tasks = tasks.filter(t => t.id !== id);
  if (task) {
    addLog('warning', 'system', `Tâche supprimée (UID: ${task.uid})`);
  }
  res.json({ success: true });
});

// 6. Settings GET & POST
app.get('/api/settings', (req, res) => {
  res.json(botSettings);
});

app.post('/api/settings', (req, res) => {
  const { customPassword, googleSheetWebhookUrl, platformName, welcomeMessage, botToken } = req.body;
  if (customPassword !== undefined) botSettings.customPassword = customPassword;
  if (googleSheetWebhookUrl !== undefined) botSettings.googleSheetWebhookUrl = googleSheetWebhookUrl;
  if (platformName !== undefined) botSettings.platformName = platformName;
  if (welcomeMessage !== undefined) botSettings.welcomeMessage = welcomeMessage;
  if (botToken !== undefined) botSettings.botToken = botToken;

  addLog('info', 'system', `Paramètres mis à jour (Mot de passe dynamique: ${botSettings.customPassword})`);
  res.json(botSettings);
});

// 7. Bot Simulation Engine (Exact Telegram State Machine)
app.post('/api/bot/simulate-step', (req, res) => {
  const { sessionId = 'sim-user-1', action, input } = req.body;
  
  if (!userSessions[sessionId]) {
    userSessions[sessionId] = { step: 'START' };
  }
  const session = userSessions[sessionId];

  let responseMessage = '';
  let buttons: any[] = [];
  let normalizedAction = action || 'START';
  const inputText = (input || '').trim();
  const lowerInput = inputText.toLowerCase();

  // Natural text or action dispatch for persistent buttons
  if (
    normalizedAction === 'MENU_BALANCE' ||
    normalizedAction === '💰 Solde' ||
    inputText.includes('Solde') ||
    lowerInput === 'solde' ||
    lowerInput === '/solde' ||
    lowerInput === '/balance'
  ) {
    normalizedAction = 'MENU_BALANCE';
  } else if (
    normalizedAction === 'CHOOSE_FACEBOOK' ||
    normalizedAction === '📋 Tâches' ||
    normalizedAction === '🌐 Démarrer tâche Facebook' ||
    inputText.includes('Tâches') ||
    inputText.includes('Taches') ||
    inputText.includes('Démarrer tâche') ||
    lowerInput === 'taches' ||
    lowerInput === 'tâches' ||
    lowerInput === '/tasks' ||
    lowerInput === '/taches'
  ) {
    normalizedAction = 'CHOOSE_FACEBOOK';
  } else if (
    normalizedAction === 'MENU_WITHDRAW' ||
    normalizedAction === '🏦 Retrait' ||
    inputText.includes('Retrait') ||
    lowerInput === 'retrait' ||
    lowerInput === '/withdraw'
  ) {
    normalizedAction = 'MENU_WITHDRAW';
  } else if (
    normalizedAction === 'MENU_SUPPORT' ||
    normalizedAction === '📞 Support' ||
    inputText.includes('Support') ||
    inputText.includes('Assistance') ||
    lowerInput === 'support' ||
    lowerInput === '/support'
  ) {
    normalizedAction = 'MENU_SUPPORT';
  } else if (
    normalizedAction === 'MENU_REFERRAL' ||
    normalizedAction === '👥 Parrainages' ||
    inputText.includes('Parrainage') ||
    inputText.includes('Parrainages') ||
    lowerInput === 'parrainage' ||
    lowerInput === '/referral'
  ) {
    normalizedAction = 'MENU_REFERRAL';
  } else if (
    normalizedAction === 'MENU_LEADERBOARD' ||
    normalizedAction === '🏆 Classement' ||
    inputText.includes('Classement') ||
    lowerInput === 'classement' ||
    lowerInput === '/leaderboard' ||
    lowerInput === '/top'
  ) {
    normalizedAction = 'MENU_LEADERBOARD';
  } else if (
    normalizedAction === 'MENU_LANGUAGE' ||
    normalizedAction === '🪩 Langue' ||
    inputText.includes('Langue') ||
    inputText.includes('Langues') ||
    lowerInput === 'langue' ||
    lowerInput === 'language' ||
    lowerInput === '/language'
  ) {
    normalizedAction = 'MENU_LANGUAGE';
  }

  switch (normalizedAction) {
    case 'START':
    case '/start':
      session.step = 'START';
      responseMessage = `👋 Bienvenue sur ${botSettings.platformName} (@TaskifyProBot) !\n\nUtilisez le menu principal ci-dessous pour gérer vos tâches, suivre vos gains ou demander un retrait.\n\n👉 Cliquez sur [ 📋 Tâches ] pour commencer.`;
      buttons = [
        [
          { text: '🌐 Facebook (1.50 € / tâche)', action: 'CHOOSE_FACEBOOK', variant: 'primary' },
          { text: 'ℹ️ Consignes & Règles', action: 'ACTION_TASK_RULES', variant: 'secondary' }
        ]
      ];
      addLog('info', 'simulator', `Simulateur: /start initialisé par l'utilisateur.`);
      break;

    case 'MENU_BALANCE':
      session.step = 'BALANCE';
      responseMessage = `💰 *Votre Solde & Activité*\n\n` +
        `👤 Utilisateur : *Opérateur Simulateur* (@simulateur_user)\n` +
        `🆔 ID Compte : \`sim_${sessionId}\`\n` +
        `🛡️ Statut du compte : *Vérifié* ✅\n\n` +
        `💵 *Solde validé disponible :* \`0.00 €\`\n` +
        `⏳ *En cours de validation :* \`0.00 €\`\n` +
        `📊 *Tâches validées :* \`0\`\n` +
        `👥 *Filleuls actifs :* \`0\` (\`+0.00 €\`)\n\n` +
        `_Rémunération standard : 1.50 € par compte Facebook validé._`;
      buttons = [
        [
          { text: '📋 Effectuer une Tâche', action: 'CHOOSE_FACEBOOK', variant: 'primary' },
          { text: '🏦 Demander un Retrait', action: 'MENU_WITHDRAW', variant: 'secondary' }
        ]
      ];
      break;

    case 'MENU_WITHDRAW':
      session.step = 'WITHDRAW';
      responseMessage = `🏦 *Demande de Retrait de Gains*\n\n` +
        `💵 Solde disponible : *0.00 €*\n` +
        `🎯 Seuil minimum de retrait : *10.00 €*\n` +
        `🛡️ Statut : 🟡 *En attente du seuil (10.00 €)*\n\n` +
        `Moyens de paiement pris en charge :\n` +
        `• 📱 *Mobile Money* (MVola, Orange Money, Airtel Money)\n` +
        `• 🪙 *Crypto USDT* (TRC20 / BEP20 - 0 frais)\n` +
        `• 💳 *Virement Bancaire SEPA*\n\n` +
        `_Sélectionnez votre moyen de retrait ci-dessous :_`;
      buttons = [
        [
          { text: '📱 Mobile Money', action: 'WITHDRAW_MOBILE', variant: 'secondary' },
          { text: '🪙 Crypto (USDT)', action: 'WITHDRAW_CRYPTO', variant: 'secondary' },
          { text: '💳 Virement Bancaire', action: 'WITHDRAW_BANK', variant: 'secondary' }
        ]
      ];
      break;

    case 'WITHDRAW_MOBILE':
      responseMessage = `📱 *Retrait Mobile Money (MVola, Orange Money, Airtel Money)*\n\n` +
        `Montant minimum requis : *10.00 €*\n\n` +
        `Pour soumettre votre demande, transmettez votre numéro de téléphone et opérateur au support officiel : @TaskifySupport`;
      buttons = [
        [
          { text: '💬 Ouvrir le Support', action: 'MENU_SUPPORT', variant: 'primary' },
          { text: '🔙 Retour au Menu', action: 'START', variant: 'secondary' }
        ]
      ];
      break;

    case 'WITHDRAW_CRYPTO':
      responseMessage = `🪙 *Retrait Crypto USDT (TRC-20 / BEP-20)*\n\n` +
        `Frais réseau : *0 € (Offerts)*\n` +
        `Seuil minimum : *10.00 €*\n\n` +
        `Veuillez transmettre votre adresse de portefeuille USDT au gestionnaire : @TaskifySupport`;
      buttons = [
        [
          { text: '💬 Ouvrir le Support', action: 'MENU_SUPPORT', variant: 'primary' },
          { text: '🔙 Retour au Menu', action: 'START', variant: 'secondary' }
        ]
      ];
      break;

    case 'WITHDRAW_BANK':
      responseMessage = `💳 *Virement Bancaire (SEPA)*\n\n` +
        `Délai moyen de traitement : 24h à 48h ouvrées.\n` +
        `Transmettez votre RIB / IBAN au support : @TaskifySupport`;
      buttons = [
        [
          { text: '💬 Ouvrir le Support', action: 'MENU_SUPPORT', variant: 'primary' },
          { text: '🔙 Retour au Menu', action: 'START', variant: 'secondary' }
        ]
      ];
      break;

    case 'MENU_SUPPORT':
      session.step = 'SUPPORT';
      responseMessage = `📞 *Support & Assistance Opérateurs*\n\n` +
        `Une question technique, un blocage ou une demande de paiement ?\n\n` +
        `👤 *Administrateur Support :* @TaskifySupport\n` +
        `📢 *Canal Officiel :* @TaskifyAnnouncements\n` +
        `⏰ *Horaires :* 7j/7 — 08h00 à 22h00 (UTC+1)\n` +
        `⚡ *Délai moyen de réponse :* < 15 minutes\n\n` +
        `_Cliquez ci-dessous pour plus d'options :_`;
      buttons = [
        [
          { text: '❓ FAQ & Questions Fréquentes', action: 'ACTION_FAQ', variant: 'secondary' },
          { text: '🚀 Démarrer une Tâche', action: 'CHOOSE_FACEBOOK', variant: 'primary' }
        ]
      ];
      break;

    case 'ACTION_FAQ':
      responseMessage = `❓ *FAQ & Questions Fréquentes*\n\n` +
        `• *Validation des comptes :* Instantanée dès réception de l'UID et des cookies complets.\n` +
        `• *Paiements :* Retrait débloqué dès 10.00 € via Mobile Money ou USDT.\n` +
        `• *Parrainage :* +0.25 € reversé à chaque tâche complétée par vos filleuls.\n` +
        `• *Contact direct :* @TaskifySupport`;
      buttons = [
        [{ text: '🚀 Démarrer une Tâche', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      break;

    case 'MENU_REFERRAL':
      session.step = 'REFERRAL';
      responseMessage = `👥 *Programme de Parrainage ${botSettings.platformName}*\n\n` +
        `Invitez d'autres opérateurs et gagnez des commissions automatiques !\n\n` +
        `💎 *Gains par tâche validée par un filleul :* \`+0.25 €\`\n` +
        `📊 *Nombre de filleuls actifs :* \`0\`\n` +
        `💵 *Total des commissions perçues :* \`0.00 €\`\n\n` +
        `🔗 *Votre lien de parrainage unique :*\n` +
        `\`https://t.me/TaskifyProBot?start=ref_sim_${sessionId}\`\n\n` +
        `_Partagez ce lien à vos connaissances pour commencer à accumuler des revenus passifs._`;
      buttons = [
        [{ text: '🚀 Faire des tâches', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      break;

    case 'MENU_LEADERBOARD':
      session.step = 'LEADERBOARD';
      responseMessage = `🏆 *Classement des Meilleurs Opérateurs (Ce Mois)*\n\n` +
        `1. 🥇 Opérateur #9482 — \`428 tâches\` (Prime +50.00 €)\n` +
        `2. 🥈 Opérateur #1092 — \`391 tâches\` (Prime +30.00 €)\n` +
        `3. 🥉 Opérateur #7401 — \`315 tâches\` (Prime +15.00 €)\n` +
        `4. ⭐ Opérateur #5892 — \`280 tâches\`\n` +
        `5. ⭐ Opérateur #3419 — \`204 tâches\`\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📍 *Votre Position :* \`Top 15%\`\n` +
        `📊 *Vos Tâches :* \`0 validées\` (\`0.00 €\` gagnés)\n\n` +
        `_Primes versées automatiquement chaque 1er du mois aux 3 premiers du classement._`;
      buttons = [
        [{ text: '🚀 Faire des tâches pour grimper', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      break;

    case 'MENU_LANGUAGE':
      session.step = 'LANGUAGE';
      responseMessage = `🪩 *Sélection de la Langue / Language / Fiteny*\n\n` +
        `Langue actuelle : 🇫🇷 *Français*\n\n` +
        `Choisissez votre langue de préférence ci-dessous :`;
      buttons = [
        [
          { text: '🇫🇷 Français', action: 'SET_LANG_FR', variant: 'primary' },
          { text: '🇲🇬 Malagasy', action: 'SET_LANG_MG', variant: 'secondary' },
          { text: '🇬🇧 English', action: 'SET_LANG_EN', variant: 'secondary' }
        ]
      ];
      break;

    case 'SET_LANG_FR':
      responseMessage = `✅ La langue du bot reste configurée en **Français**.`;
      buttons = [[{ text: '📋 Voir les Tâches', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]];
      break;

    case 'SET_LANG_MG':
      responseMessage = `✅ Voafaritra amin'ny teny **Malagasy** ny bot.`;
      buttons = [[{ text: '📋 Hanao Asa (Tâches)', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]];
      break;

    case 'SET_LANG_EN':
      responseMessage = `🌐 Language updated to **English**.`;
      buttons = [[{ text: '📋 View Tasks', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]];
      break;

    case 'ACTION_TASK_RULES':
      responseMessage = `📋 *Consignes & Règles de Création Facebook*\n\n` +
        `1. Créez un compte Facebook avec le Prénom, Nom et Mot de passe fournis.\n` +
        `2. Récupérez l'identifiant UID unique du profil créé.\n` +
        `3. Exportez les cookies complets au format standard (c_user, datr, xs...).\n` +
        `4. Transmettez les éléments au bot pour validation immédiate.\n\n` +
        `_Rémunération : 1.50 € par compte validé._`;
      buttons = [
        [{ text: '🚀 Démarrer la tâche maintenant', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      break;

    case 'HELP':
      responseMessage = `📌 *Taskify Pro (@TaskifyProBot) - Aide*\n\nCe système automatise l'enregistrement de vos tâches et la transmission des UID / Cookies vers Google Sheets.\n\nCliquez ci-dessous pour démarrer :`;
      buttons = [
        [{ text: '🌐 Démarrer tâche Facebook', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      break;

    case 'CHOOSE_FACEBOOK':
      session.step = 'AUTH_CHOICE';
      session.taskType = 'Facebook';
      responseMessage = `🌐 *Tâche : Création de Compte Facebook*\n\n` +
        `💵 Rémunération par compte validé : *1.50 €*\n\n` +
        `Choisissez votre méthode d'authentification pour cette tâche :\n\n` +
        `• 🍪 *Cookies* : Recommandé pour validation et enregistrement immédiat.\n` +
        `• 🔐 *2FA* : Authentification par clé sécurisée.\n\n` +
        `_Sélectionnez votre option ci-dessous :_`;
      buttons = [
        [
          { text: '🍪 Cookies (Recommandé)', action: 'CHOOSE_COOKIES', variant: 'primary' },
          { text: '🔐 2FA', action: 'CHOOSE_2FA', variant: 'secondary' }
        ],
        [
          { text: 'ℹ️ Consignes & Règles', action: 'ACTION_TASK_RULES', variant: 'secondary' }
        ],
        [
          { text: '❌ Annuler le processus', action: 'CANCEL', variant: 'danger' }
        ]
      ];
      break;

    case 'CHOOSE_2FA':
      session.step = '2FA_NOTICE';
      responseMessage = `⚠️ *Authentification 2FA non disponible*\n\nLa méthode 2FA est temporairement suspendue. Veuillez impérativement utiliser l'authentification par *Cookies*.\n\nCliquez sur le bouton ci-dessous pour recommencer :`;
      buttons = [
        [
          { text: '🔄 Choisir Cookies', action: 'CHOOSE_COOKIES', variant: 'primary' },
          { text: '↩️ Menu Principal', action: 'START', variant: 'secondary' }
        ]
      ];
      addLog('warning', 'simulator', `Simulateur: L'utilisateur a sélectionné 2FA (non supporté).`);
      break;

    case 'CHOOSE_COOKIES':
      const name = generateRandomName();
      session.firstName = name.firstName;
      session.lastName = name.lastName;
      session.password = botSettings.customPassword;
      session.step = 'CREDENTIALS_SHOWN';

      responseMessage = `⚠️ *Informations du compte Facebook*\n\n` +
        `✅ Prénom : \`${name.firstName}\`\n` +
        `✅ Nom : \`${name.lastName}\`\n` +
        `🇫🇷 Mot de passe : \`${botSettings.customPassword}\`\n\n` +
        `🔻 Une fois le compte créé, envoyez votre UID.`;
      
      buttons = [
        [{ text: '📥 Envoyer l\'UID', action: 'PROMPT_UID', variant: 'primary' }],
        [{ text: '🔙 Retour', action: 'CHOOSE_FACEBOOK', variant: 'secondary' }],
        [{ text: '❌ Annuler le processus', action: 'CANCEL', variant: 'danger' }]
      ];
      addLog('info', 'simulator', `Simulateur: Identité générée (${name.firstName} ${name.lastName})`);
      break;

    case 'PROMPT_UID':
      session.step = 'AWAITING_UID';
      responseMessage = `✍️ *Étape 1/2 : Envoi de l'UID*\n\nVeuillez saisir ou coller votre *UID Facebook* dans le champ texte ci-dessous (ex: \`100084928172910\`) :`;
      buttons = [
        [{ text: '❌ Annuler le processus', action: 'CANCEL', variant: 'danger' }]
      ];
      break;

    case 'SEND_UID_TEXT':
      if (!input || !input.trim()) {
        responseMessage = `⚠️ Veuillez fournir un UID valide.`;
        buttons = [[{ text: '❌ Annuler', action: 'CANCEL', variant: 'danger' }]];
      } else {
        session.uid = input.trim();
        session.step = 'AWAITING_COOKIES';
        responseMessage = `✅ *UID reçu avec succès :* \`${session.uid}\`\n\n` +
          `🍪 *Étape 2/2 : Envoi des Cookies*\n\n` +
          `Veuillez maintenant coller vos *Cookies Facebook* (ex: \`datr=...; c_user=...; xs=...\`) :`;
        buttons = [
          [{ text: '❌ Annuler le processus', action: 'CANCEL', variant: 'danger' }]
        ];
      }
      break;

    case 'SEND_COOKIES_TEXT':
      if (!input || !input.trim()) {
        responseMessage = `⚠️ Veuillez fournir des cookies valides.`;
        buttons = [[{ text: '❌ Annuler', action: 'CANCEL', variant: 'danger' }]];
      } else {
        session.cookies = input.trim();
        
        // Save to real database
        const createdTask = {
          id: `task-${Date.now()}`,
          uid: session.uid || '1000' + Math.floor(Math.random() * 90000000000),
          cookies: session.cookies,
          firstName: session.firstName || 'Généré',
          lastName: session.lastName || 'Auto',
          password: session.password || botSettings.customPassword,
          telegramUserId: 'sim_' + sessionId,
          telegramUsername: 'simulateur_user',
          status: 'compte créé' as const,
          notes: 'Enregistré via le Simulateur de Bot interactif',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncedToGoogleSheets: false,
          taskType: session.taskType || 'Facebook'
        };

        tasks.unshift(createdTask);
        addLog('success', 'simulator', `🎉 Tâche terminée via Simulateur (UID: ${createdTask.uid})`, createdTask);

        // Async sync if webhook set
        if (botSettings.googleSheetWebhookUrl) {
          syncRowToGoogleSheets(createdTask).then(r => {
            if (r.success) createdTask.syncedToGoogleSheets = true;
          });
        }

        // Clean session
        delete userSessions[sessionId];

        responseMessage = `🎉 *Tâche terminée avec succès !*\n\n` +
          `✅ Vos informations ont été enregistrées avec succès dans le tableau de bord et synchronisées.\n\n` +
          `🆔 *UID :* \`${createdTask.uid}\`\n` +
          `👤 *Nom complet :* ${createdTask.firstName} ${createdTask.lastName}\n` +
          `📅 *Date :* ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}\n\n` +
          `Merci pour votre travail !`;

        buttons = [
          [{ text: '🚀 Nouvelle Tâche Facebook', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
        ];
      }
      break;

    case 'CANCEL':
      delete userSessions[sessionId];
      responseMessage = `❌ *Processus annulé.*\n\nAucune donnée n'a été enregistrée. Cliquez ci-dessous pour recommencer :`;
      buttons = [
        [{ text: '🚀 Démarrer une nouvelle tâche', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      addLog('info', 'simulator', `Simulateur: Processus annulé par l'utilisateur.`);
      break;

    case 'USER_TEXT':
    default:
      if (!session || !session.step || session.step === 'START') {
        responseMessage = `👋 Bonjour ! Utilisez le menu principal ci-dessous ou cliquez sur [ 📋 Tâches ] pour commencer :`;
        buttons = [
          [{ text: '🚀 Démarrer une Tâche Facebook', action: 'CHOOSE_FACEBOOK', variant: 'primary' }],
          [{ text: '💰 Voir mon Solde', action: 'MENU_BALANCE', variant: 'secondary' }]
        ];
      } else {
        responseMessage = `Action prise en compte. Utilisez les boutons interactifs ci-dessous pour naviguer.`;
        buttons = [
          [{ text: '📋 Tâches Disponibles', action: 'CHOOSE_FACEBOOK', variant: 'primary' }],
          [{ text: '💰 Mon Solde', action: 'MENU_BALANCE', variant: 'secondary' }]
        ];
      }
      break;
  }

  res.json({
    step: session?.step || 'START',
    message: responseMessage,
    buttons,
    session
  });
});

// 8. Test Google Sheets Webhook
app.post('/api/test-google-sheets', async (req, res) => {
  const { url } = req.body;
  const targetUrl = url || botSettings.googleSheetWebhookUrl;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL Webhook Google Sheets requise' });
  }

  try {
    const testPayload = {
      action: 'ping_test',
      timestamp: new Date().toISOString(),
      platform: botSettings.platformName,
      message: 'Test de connexion réussi depuis Task By RFC Office',
      uid: 'TEST_UID_999999',
      cookies: 'datr=test_cookie_sample; c_user=TEST_UID_999999',
      firstName: 'Jean',
      lastName: 'Dupont',
      password: botSettings.customPassword,
      telegramUserId: 'test_admin',
      telegramUsername: 'admin_rfc',
      status: 'compte créé',
      notes: 'Ligne de test générée par le tableau de bord'
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    const responseText = await response.text();
    addLog('success', 'sheets', `Ping Google Sheets réussi vers ${targetUrl}`);
    res.json({ success: true, response: responseText });
  } catch (error: any) {
    addLog('error', 'sheets', `Erreur de test Google Sheets: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Sync All Tasks to Sheets
app.post('/api/sync-all-to-sheets', async (req, res) => {
  if (!botSettings.googleSheetWebhookUrl) {
    return res.status(400).json({ error: 'URL Google Sheet non configurée' });
  }

  let count = 0;
  for (const task of tasks) {
    const result = await syncRowToGoogleSheets(task);
    if (result.success) {
      task.syncedToGoogleSheets = true;
      count++;
    }
  }

  botSettings.lastSyncedAt = new Date().toISOString();
  addLog('success', 'sheets', `Synchronisation globale : ${count} tâches envoyées.`);
  res.json({ success: true, count });
});

// 10. Get Logs
app.get('/api/logs', (req, res) => {
  res.json(logs);
});

// 11. Real Telegram Bot Service Toggle (Polling / Webhook)
app.post('/api/bot/toggle-service', async (req, res) => {
  const { token, action } = req.body;
  const botToken = token || botSettings.botToken;

  if (action === 'stop') {
    if (activeTelegrafBot) {
      try {
        activeTelegrafBot.stop('SIGINT');
      } catch (e) {}
      activeTelegrafBot = null;
    }
    botSettings.isBotActive = false;
    addLog('info', 'telegram', 'Service Telegram Bot arrêté.');
    return res.json({ success: true, isBotActive: false });
  }

  if (!botToken || botToken.trim().length < 10) {
    return res.status(400).json({ error: 'Token de bot Telegram invalide ou manquant' });
  }

  try {
    if (activeTelegrafBot) {
      try { activeTelegrafBot.stop('SIGINT'); } catch (e) {}
      activeTelegrafBot = null;
    }

    const bot = new Telegraf(botToken);
    setupTelegrafHandlers(bot);
    
    // Test bot info
    const me = await bot.telegram.getMe();
    
    // Launch polling mode
    bot.launch().catch(err => {
      addLog('error', 'telegram', `Erreur polling Telegram: ${err.message}`);
    });

    activeTelegrafBot = bot;
    botSettings.botToken = botToken;
    botSettings.isBotActive = true;

    addLog('success', 'telegram', `Bot Telegram connecté avec succès (@${me.username})`);
    res.json({ success: true, isBotActive: true, botInfo: me });
  } catch (error: any) {
    addLog('error', 'telegram', `Impossible de connecter le bot: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 12. Real Telegram Webhook Endpoint
app.post('/api/telegram-webhook', async (req, res) => {
  if (activeTelegrafBot) {
    try {
      await activeTelegrafBot.handleUpdate(req.body);
    } catch (err: any) {
      console.error('Webhook update error:', err);
    }
  }
  res.sendStatus(200);
});

// 13. Exportable Files Endpoint
app.get('/api/export-files', (req, res) => {
  const standaloneBotJs = `/**
 * Taskify Pro - Standalone Telegram Bot (@TaskifyProBot)
 * 100% FREE Hosting on Render / Railway / Vercel / VPS
 * Requirements: npm install telegraf dotenv
 */

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GOOGLE_SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL;
let CUSTOM_PASSWORD = process.env.DEFAULT_BOT_PASSWORD || "TaskPassword@2025!";

if (!BOT_TOKEN) {
  console.error("❌ ERREUR: TELEGRAM_BOT_TOKEN manquant dans le fichier .env");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// French Names Generator
const FIRST_NAMES = ['Alexandre', 'Thomas', 'Julien', 'Nicolas', 'Maxime', 'Lucas', 'Antoine', 'Romain', 'Camille', 'Emma', 'Léa', 'Chloé', 'Sarah'];
const LAST_NAMES = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Laurent', 'Dupont'];

function getRandomName() {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return { first, last };
}

// User session storage
const sessions = {};

// Google Sheets Sync function
async function saveToGoogleSheets(data) {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log("✅ Données sauvegardées dans Google Sheets:", data.uid);
  } catch (err) {
    console.error("❌ Erreur Google Sheets:", err.message);
  }
}

// /start command
bot.start(async (ctx) => {
  const userId = String(ctx.from.id);
  sessions[userId] = { step: 'START' };

  await ctx.reply(
    "👋 *Bienvenue sur Taskify Pro (@TaskifyProBot) !*\\n\\nVeuillez choisir une tâche à exécuter :",
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🌐 Facebook', 'task_facebook')],
        [Markup.button.callback('ℹ️ Aide', 'task_help')]
      ])
    }
  );
});

bot.action('task_help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("📌 *Taskify Pro (@TaskifyProBot)*\\nAutomatisation de création de comptes et synchronisation Google Sheets.\\nTapez /start pour commencer.", { parse_mode: 'Markdown' });
});

bot.action('task_facebook', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from.id);
  sessions[userId] = { step: 'AUTH_CHOICE', taskType: 'Facebook' };

  await ctx.reply(
    "🌐 *Tâche : Facebook*\\n\\nChoisissez votre méthode d'authentification :",
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🍪 Cookies', 'auth_cookies')],
        [Markup.button.callback('🔐 2FA', 'auth_2fa')],
        [Markup.button.callback('❌ Annuler', 'action_cancel')]
      ])
    }
  );
});

bot.action('auth_2fa', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from.id);
  delete sessions[userId];

  await ctx.reply(
    "⚠️ *Authentification 2FA non supportée*\\nVeuillez utiliser l'option *Cookies* pour cette tâche.",
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Recommencer', 'task_facebook')]
      ])
    }
  );
});

bot.action('auth_cookies', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from.id);
  const { first, last } = getRandomName();

  sessions[userId] = {
    step: 'CREDENTIALS_SHOWN',
    firstName: first,
    lastName: last,
    password: CUSTOM_PASSWORD
  };

  await ctx.reply(
    \`📋 *Informations générées pour votre compte :*\\n\\n\` +
    \`👤 *Prénom :* \\\`\${first}\\\`\\n\` +
    \`👤 *Nom :* \\\`\${last}\\\`\\n\` +
    \`🔑 *Mot de passe :* \\\`\${CUSTOM_PASSWORD}\\\`\\n\\n\` +
    \`Cliquez sur le bouton ci-dessous pour transmettre votre UID Facebook :\`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📤 Envoie UID', 'action_send_uid')],
        [Markup.button.callback('❌ Annulation processus', 'action_cancel')]
      ])
    }
  );
});

bot.action('action_send_uid', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from.id);
  if (!sessions[userId]) sessions[userId] = {};
  sessions[userId].step = 'AWAITING_UID';

  await ctx.reply("✍️ *Étape 1/2 :* Veuillez envoyer votre **UID Facebook** :", {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback('❌ Annuler', 'action_cancel')]])
  });
});

bot.action('action_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = String(ctx.from.id);
  delete sessions[userId];
  await ctx.reply("❌ Processus annulé. Tapez /start pour recommencer.");
});

bot.on('text', async (ctx) => {
  const userId = String(ctx.from.id);
  const username = ctx.from.username || ctx.from.first_name || 'utilisateur';
  const text = ctx.message.text.trim();
  const session = sessions[userId];

  if (!session) return;

  if (session.step === 'AWAITING_UID') {
    session.uid = text;
    session.step = 'AWAITING_COOKIES';

    await ctx.reply(
      \`✅ *UID enregistré :* \\\`\${text}\\\`\\n\\n🍪 *Étape 2/2 :* Veuillez maintenant envoyer vos **Cookies Facebook** :\`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ Annuler', 'action_cancel')]])
      }
    );
    return;
  }

  if (session.step === 'AWAITING_COOKIES') {
    session.cookies = text;

    const record = {
      action: 'insert_task',
      id: 'task-' + Date.now(),
      timestamp: new Date().toISOString(),
      uid: session.uid,
      cookies: session.cookies,
      firstName: session.firstName || 'Généré',
      lastName: session.lastName || 'Auto',
      password: session.password || CUSTOM_PASSWORD,
      telegramUserId: userId,
      telegramUsername: username,
      status: 'compte créé',
      notes: 'Soumis via Telegram Bot Taskify Pro'
    };

    // Save to Google Sheets
    await saveToGoogleSheets(record);
    delete sessions[userId];

    await ctx.reply(
      \`🎉 *Tâche terminée avec succès !*\\n\\n\` +
      \`✅ Vos identifiants et cookies ont été validés et enregistrés.\\n\` +
      \`🆔 UID : \\\`\${record.uid}\\\`\\n\` +
      \`👤 Nom : \${record.firstName} \${record.lastName}\\n\\n\` +
      \`Merci !\`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('🚀 Nouvelle Tâche', 'task_facebook')]])
      }
    );
  }
});

bot.launch().then(() => {
  console.log('🤖 Bot Telegram Taskify Pro (@TaskifyProBot) opérationnel !');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
`;

  const standaloneGoogleAppsScript = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - Taskify Pro Database Webhook (@TaskifyProBot)
 * =========================================================================
 * 100% GRATUIT A VIE (Aucune carte bancaire requise)
 * 
 * Instructions de déploiement :
 * 1. Ouvrez Google Sheets -> Créez une feuille vierge
 * 2. Menu : Extensions -> Apps Script
 * 3. Supprimez tout et collez ce script complet
 * 4. Cliquez sur "Déployer" (en haut à droite) -> "Nouveau déploiement"
 * 5. Type : "Application Web"
 *    - Description : "Taskify Pro API"
 *    - Exécuter en tant que : "Moi (votre compte Google)"
 *    - Qui a accès : "Tout le monde" (IMPORTANT !)
 * 6. Cliquez sur Déployer, Autorisez l'accès, puis copiez l'URL Web App (se termine par /exec)
 * 7. Collez cette URL dans le Dashboard Taskify Pro !
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Évite les écritures simultanées conflictuelles

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Initialise les en-têtes si la feuille est vide
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Date & Heure",
        "ID Tâche",
        "Statut",
        "UID Facebook",
        "Prénom",
        "Nom",
        "Mot de passe",
        "Cookies",
        "ID Telegram",
        "Username Telegram",
        "Notes"
      ]);
      // Met en forme l'en-tête (Gras + Fond bleu foncé)
      var headerRange = sheet.getRange(1, 1, 1, 11);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1e293b");
      headerRange.setFontColor("#ffffff");
    }

    var contents = e.postData.contents;
    var data = JSON.parse(contents);

    var now = new Date();
    var formattedDate = Utilities.formatDate(now, "Europe/Paris", "yyyy-MM-dd HH:mm:ss");

    var row = [
      formattedDate,
      data.id || "task-" + now.getTime(),
      data.status || "compte créé",
      "'" + (data.uid || ""), // Force en chaîne pour préserver les zéros initiaux
      data.firstName || "",
      data.lastName || "",
      data.password || "",
      data.cookies || "",
      "'" + (data.telegramUserId || ""),
      "@" + (data.telegramUsername || "").replace("@", ""),
      data.notes || ""
    ];

    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Tâche enregistrée avec succès dans Google Sheets",
      rowNumber: sheet.getLastRow(),
      uid: data.uid
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    platform: "Taskify Pro",
    bot: "@TaskifyProBot",
    message: "Google Apps Script Webhook API est fonctionnel !"
  })).setMimeType(ContentService.MimeType.JSON);
}
`;

  res.json({
    botJs: standaloneBotJs,
    googleAppsScript: standaloneGoogleAppsScript,
    envExample: `TELEGRAM_BOT_TOKEN="votre_token_botfather_ici"\nGOOGLE_SHEET_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"\nDEFAULT_BOT_PASSWORD="TaskPassword@2025!"\nPORT=3000`,
    packageJson: `{\n  "name": "taskify-pro-bot",\n  "version": "1.0.0",\n  "main": "bot.js",\n  "scripts": {\n    "start": "node bot.js"\n  },\n  "dependencies": {\n    "dotenv": "^16.4.5",\n    "telegraf": "^4.16.3"\n  }\n}`
  });
});

// ----------------------------------------------------
// VITE MIDDLEWARE / SPA STATIC HANDLER
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Taskify Pro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
