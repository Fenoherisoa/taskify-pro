import { pool } from './database';
import { BotMessagesConfig } from '../types';

export const DEFAULT_BOT_MESSAGES: BotMessagesConfig = {
  fr: {
    welcome: `👋 *Bienvenue sur Taskify Pro (@TaskifyProBot) !*\n\nPlateforme officielle d'exécution et de validation de tâches rémunérées.\n\n💵 *Rémunération :* \`$0.04\` par compte validé\n🎯 *Seuil de retrait :* \`$1.00\`\n\nUtilisez le menu ci-dessous ou cliquez pour démarrer :`,
    balance_title: `💰 *Votre Solde & Activité*`,
    tasks_title: `🌐 *Tâche : Création de Compte Facebook*`,
    withdrawal_title: `🏦 *Demande de Retrait de Gains*`,
    support_title: `📞 *Support & Assistance Opérateurs*\n\nPour toute question ou assistance technique, contactez notre équipe support : @TaskifySupport`,
    referral_title: `👥 *Programme de Parrainage & Commissions*`,
    leaderboard_title: `🏆 *Classement des Meilleurs Opérateurs (Ce Mois)*`,
    lang_title: `🪩 *Sélection de la Langue*`,
    lang_confirm: `✅ La langue du bot est maintenant configurée en **Français** 🇫🇷.`,
    btn_tasks: `📋 Effectuer une Tâche`,
    btn_withdraw: `🏦 Demander un Retrait`,
    btn_support: `💬 Contacter le Support`,
    btn_rules: `ℹ️ Consignes & Règles`,
    btn_cancel: `❌ Annuler le processus`,
    btn_cookies: `🍪 Cookies (Recommandé)`,
    btn_2fa: `🔐 2FA (Clé d'accès)`,
    btn_send_uid: `📥 Envoyer l'UID`,
    btn_share_ref: `📤 Partager mon lien`,
    cookies_reward_notice: `💵 *Rémunération par compte validé :* \`$0.04\``,
    task_rules_text: `📋 *Consignes & Règles de Validation Facebook*\n\n1. Utilisez obligatoirement le prénom et le nom fournis.\n2. Utilisez le mot de passe assigné sans le modifier.\n3. Extrayez les cookies complets contenant \`c_user\`, \`datr\` et \`xs\`.\n4. Rémunération : \`$0.04\` par tâche validée.`,
    awaiting_uid: `✍️ *Étape 1/2 : Envoi de l'UID Facebook*\n\nVeuillez coller votre **UID Facebook** (ex: \`100084928172910\`) :`,
    awaiting_cookies: `🍪 *Étape 2/2 : Envoi des Cookies*\n\nVeuillez maintenant coller vos **Cookies Facebook** complets (ex: format \`datr=...; c_user=...; xs=...\`) :`,
    cancelled: `❌ *Processus annulé.*\nAucune donnée n'a été enregistrée.`,
    withdrawal_pending: `⏳ Demande de retrait enregistrée. Votre requête est en attente d'approbation par un administrateur.`,
    withdrawal_approved: `✅ Transaction réussie. Votre retrait a été approuvé.`,
    withdrawal_paid: `💸 Paiement envoyé ! Les fonds ont été transférés avec succès.`,
    withdrawal_rejected: `❌ Retrait refusé.\nMotif : {reason}\nVos fonds ont été reversés sur votre solde.`,
    verification_verified: `✅ Compte vérifié\n\nVotre compte Facebook a été validé avec succès.\n💰 +${'{reward}'} USD ajouté à votre solde.\n\n💵 Solde actuel : ${'{balance}'} USD`,
    verification_rejected: `❌ Compte refusé\n\nVotre compte Facebook n'a pas été accepté.\nMotif : ${'{reason}'}\n\n💵 Solde actuel : ${'{balance}'} USD`,
    wallet_info_saved: `✅ Coordonnées de portefeuille enregistrées avec succès !`,
    wallet_info_deleted: `🗑️ Coordonnées de portefeuille supprimées avec succès.`,
    task_submitted_confirmation: `✅ *Tâche reçue avec succès !*\n\nVotre tâche a été enregistrée et est désormais **en attente de validation** par l'administrateur.\n\nVous pouvez créer une nouvelle tâche dès que vous le souhaitez.`,
    btn_create_new_task: `➕ Créer une nouvelle tâche`
  },
  en: {
    welcome: `👋 *Welcome to Taskify Pro (@TaskifyProBot)!*\n\nOfficial automated platform for rewarded account creation tasks.\n\n💵 *Task Reward:* \`$0.04\` per verified account\n🎯 *Min Payout:* \`$1.00\`\n\nUse the persistent menu below to start working:`,
    balance_title: `💰 *Your Balance & Performance*`,
    tasks_title: `🌐 *Task: Facebook Account Creation*`,
    withdrawal_title: `🏦 *Payout Request*`,
    support_title: `📞 *Support & Helpdesk*\n\nFor any inquiries or assistance, please reach out to our team: @TaskifySupport`,
    referral_title: `👥 *Referral Program & Commissions*`,
    leaderboard_title: `🏆 *Top Operators Leaderboard (This Month)*`,
    lang_title: `🪩 *Language Selection*`,
    lang_confirm: `✅ Bot language updated to **English** 🇬🇧.`,
    btn_tasks: `📋 Start a Task`,
    btn_withdraw: `🏦 Request Payout`,
    btn_support: `💬 Contact Support`,
    btn_rules: `ℹ️ Guidelines & Rules`,
    btn_cancel: `❌ Cancel Process`,
    btn_cookies: `🍪 Cookies (Recommended)`,
    btn_2fa: `🔐 2FA (Access Key)`,
    btn_send_uid: `📥 Submit UID`,
    btn_share_ref: `📤 Share Referral Link`,
    cookies_reward_notice: `💵 *Reward per verified account:* \`$0.04\``,
    task_rules_text: `📋 *Facebook Account Guidelines*\n\n1. Always use the generated First & Last name.\n2. Use the exact assigned password.\n3. Export full cookies including \`c_user\`, \`datr\` and \`xs\`.\n4. Reward: \`$0.04\` per valid submission.`,
    awaiting_uid: `✍️ *Step 1/2: Submit Facebook UID*\n\nPlease paste your **Facebook UID** (e.g. \`100084928172910\`) :`,
    awaiting_cookies: `🍪 *Step 2/2: Submit Cookies*\n\nPlease paste your full **Facebook Cookies** (e.g. \`datr=...; c_user=...; xs=...\`) :`,
    cancelled: `❌ *Process cancelled.*\nNo data has been saved.`,
    withdrawal_pending: `⏳ Withdrawal pending. Your request is waiting for approval.`,
    withdrawal_approved: `✅ Transaction successful. Your withdrawal has been approved.`,
    withdrawal_paid: `💸 Payment sent! Your payout has been successfully transferred.`,
    withdrawal_rejected: `❌ Withdrawal rejected.\nReason: {reason}\nYour funds have been refunded to your balance.`,
    verification_verified: `✅ Account verified\n\nYour Facebook account has been verified successfully.\n💰 +${'{reward}'} USD added to your balance.\n\n💵 Current balance : ${'{balance}'} USD`,
    verification_rejected: `❌ Account rejected\n\nYour Facebook account was not accepted.\nReason : ${'{reason}'}\n\n💵 Current balance : ${'{balance}'} USD`,
    wallet_info_saved: `✅ Wallet information saved successfully!`,
    wallet_info_deleted: `🗑️ Wallet information removed successfully.`,
    task_submitted_confirmation: `✅ *Task successfully received!*\n\nYour task has been submitted and is now **pending validation** by the administrator.\n\nYou can create another task whenever you want.`,
    btn_create_new_task: `➕ Create New Task`
  },
  mg: {
    welcome: `👋 *Tongasoa eto amin'ny Taskify Pro (@TaskifyProBot) !*\n\nSehatra ofisialy fanatontosana asa sy fakana vola.\n\n💵 *Karama :* \`$0.04\` isaky ny kaonty voamarina\n🎯 *Farafahakeliny azo alaina :* \`$1.00\`\n\nAmpiasao ny safidy eto ambany hanombohana :`,
    balance_title: `💰 *Ny Solde & Asanao*`,
    tasks_title: `🌐 *Asa : Famoronana Kaonty Facebook*`,
    withdrawal_title: `🏦 *Fangatahana Fanalana Vola*`,
    support_title: `📞 *Fanampiana & Fifandraisana*\n\nRaha misy fanontaniana na olana ara-teknika dia mifandraisa amin'ny : @TaskifySupport`,
    referral_title: `👥 *Fandaharana Fanasana Olona & Tombony*`,
    leaderboard_title: `🏆 *Filaharana Ireo Mpisehatra Mahay Indrindra*`,
    lang_title: `🪩 *Safidy Fiteny*`,
    lang_confirm: `✅ Voatsonga soa aman-tsara ny fiteny **Malagasy** 🇲🇬.`,
    btn_tasks: `📋 Hanao Asa`,
    btn_withdraw: `🏦 Mangataka Vola`,
    btn_support: `💬 Hifandray amin'ny Fanampiana`,
    btn_rules: `ℹ️ Fitsipika Arahina`,
    btn_cancel: `❌ Aoka ihany`,
    btn_cookies: `🍪 Cookies (Atoro hevitra)`,
    btn_2fa: `🔐 2FA (Fanalahidy)`,
    btn_send_uid: `📥 Handefa ny UID`,
    btn_share_ref: `📤 Hizarana ny Rohy Fanasana`,
    cookies_reward_notice: `💵 *Karama isaky ny kaonty voamarina :* \`$0.04\``,
    task_rules_text: `📋 *Fitsipika Famoronana Kaonty Facebook*\n\n1. Ampiasao foana ny anarana sy fanampin'anarana nomena.\n2. Ampiasao ny teny miafina nomena tsy asiana fiovana.\n3. Raiso ny cookies feno misy \`c_user\`, \`datr\` ary \`xs\`.\n4. Karama : \`$0.04\` isaky ny asa voamarina.`,
    awaiting_uid: `✍️ *Dingana 1/2 : Mandefa UID Facebook*\n\nApetaho eto ny **UID Facebook** (ohatra : \`100084928172910\`) :`,
    awaiting_cookies: `🍪 *Dingana 2/2 : Mandefa Cookies*\n\nApetaho eto ny **Cookies Facebook** feno (ohatra : \`datr=...; c_user=...; xs=...\`) :`,
    cancelled: `❌ *Natsahatra ny hetsika.*\nTsy nisy tahiry voatahiry.`,
    withdrawal_pending: `⏳ Miandry fankatoavana ny fangatahanao fisintahana vola.`,
    withdrawal_approved: `✅ Nahomby ny fifampiraharahana. Nekena soa aman-tsara ny fisintahana volanao.`,
    withdrawal_paid: `💸 Voaloa ny vola ! Nalefa soa aman-tsara ny fisintahana volanao.`,
    withdrawal_rejected: `❌ Tsy nekena ny fisintahana vola.\nAntony : {reason}\nNaverina amin'ny solde-nao ny vola.`,
    verification_verified: `✅ Kaonty voamarina\n\nNekena soa aman-tsara ny kaontinao.\n💰 +${'{reward}'} USD nampidirina tamin'ny solde-nao.\n\n💵 Solde ankehitriny : ${'{balance}'} USD`,
    verification_rejected: `❌ Kaonty nolavina\n\nTsy nekena ny kaontinao.\nAntony : ${'{reason}'}\n\n💵 Solde ankehitriny : ${'{balance}'} USD`,
    wallet_info_saved: `✅ Voatahiry soa aman-tsara ny adiresy fandraisana volanao !`,
    wallet_info_deleted: `🗑️ Voafafa soa aman-tsara ny adiresy fandraisana volanao.`,
    task_submitted_confirmation: `✅ *Voaray soa aman-tsara ny asa !*\n\nVoarakitra ny asanao ary **miandry fankatoavana** avy amin'ny mpitantana.\n\nAfaka manomboka asa vaovao ianao dieny izao.`,
    btn_create_new_task: `➕ Hanao asa vaovao`
  }
};

// In-memory runtime cache for high-performance bot replies
let cachedMessages: BotMessagesConfig = JSON.parse(JSON.stringify(DEFAULT_BOT_MESSAGES));

/**
 * Initialize bot messages table & load saved config
 */
export async function initBotMessages(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_translations (
        lang TEXT PRIMARY KEY,
        messages JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const res = await pool.query('SELECT lang, messages FROM bot_translations');
    for (const row of res.rows) {
      const l = row.lang as keyof BotMessagesConfig;
      if (cachedMessages[l]) {
        let parsed = row.messages;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        cachedMessages[l] = { ...cachedMessages[l], ...parsed };
      }
    }
  } catch (err: any) {
    console.warn('⚠️ Bot messages table init notice (using defaults):', err.message);
  }
}

/**
 * Retrieve all bot messages
 */
export async function getBotMessages(): Promise<BotMessagesConfig> {
  return cachedMessages;
}

/**
 * Retrieve messages for a specific language
 */
export function getBotMessagesForLang(lang?: string): Record<string, string> {
  const l = (lang || 'fr').toLowerCase();
  if (l in cachedMessages) {
    return cachedMessages[l as keyof BotMessagesConfig];
  }
  return cachedMessages.fr;
}

/**
 * Save updated bot messages (for fr, en, and mg)
 */
export async function saveBotMessages(updates: Partial<BotMessagesConfig>): Promise<{ success: boolean; messages: BotMessagesConfig }> {
  for (const lang of ['fr', 'en', 'mg'] as (keyof BotMessagesConfig)[]) {
    if (updates[lang]) {
      cachedMessages[lang] = { ...cachedMessages[lang], ...updates[lang] };
      try {
        await pool.query(`
          INSERT INTO bot_translations (lang, messages, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (lang) DO UPDATE
          SET messages = $2, updated_at = NOW()
        `, [lang, JSON.stringify(cachedMessages[lang])]);
      } catch (err: any) {
        console.warn(`⚠️ Could not persist bot messages for ${lang}:`, err.message);
      }
    }
  }
  return { success: true, messages: cachedMessages };
}

/**
 * Reset all bot messages to standard defaults
 */
export async function resetBotMessages(): Promise<{ success: boolean; messages: BotMessagesConfig }> {
  cachedMessages = JSON.parse(JSON.stringify(DEFAULT_BOT_MESSAGES));
  for (const lang of ['fr', 'en', 'mg'] as (keyof BotMessagesConfig)[]) {
    try {
      await pool.query(`DELETE FROM bot_translations WHERE lang = $1`, [lang]);
    } catch {}
  }
  return { success: true, messages: cachedMessages };
}
