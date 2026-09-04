import { pool } from './database';
import { NotificationRecord } from '../types';

export async function createNotification(
  userId: number,
  title: string,
  message: string,
  type: string = 'info'
): Promise<void> {
  try {
    await pool.query(
      `
      INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
      VALUES ($1, $2, $3, $4, FALSE, NOW())
      `,
      [userId, title, message, type]
    );
  } catch (err: any) {
    console.warn('⚠️ Could not insert notification:', err.message);
  }
}

export async function getUserNotifications(telegramUserId: string): Promise<NotificationRecord[]> {
  try {
    const res = await pool.query(
      `
      SELECT n.*
      FROM notifications n
      INNER JOIN users u ON u.id = n.user_id
      WHERE u.telegram_user_id = $1
      ORDER BY n.id DESC
      LIMIT 50
      `,
      [String(telegramUserId)]
    );

    return res.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      message: row.message,
      type: row.type || 'info',
      isRead: Boolean(row.is_read),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    }));
  } catch (err: any) {
    console.warn('⚠️ Could not fetch notifications:', err.message);
    return [];
  }
}

export async function markNotificationsRead(telegramUserId: string): Promise<void> {
  try {
    await pool.query(
      `
      UPDATE notifications n
      SET is_read = TRUE
      FROM users u
      WHERE n.user_id = u.id AND u.telegram_user_id = $1
      `,
      [String(telegramUserId)]
    );
  } catch (err: any) {
    console.warn('⚠️ Could not mark notifications as read:', err.message);
  }
}

/**
 * Formats a short professional Telegram verification message in the user's language.
 */
export function formatVerificationMessage(params: {
  isAccepted: boolean;
  isBot: boolean;
  rewardUSD?: number;
  currentBalance: number;
  reason?: string;
  language?: string;
}): string {
  const lang = (params.language || 'fr').toLowerCase();
  const rewardStr = (params.rewardUSD ?? 0.04).toFixed(2).replace('.', ',');
  const balanceStr = (params.currentBalance ?? 0).toFixed(2).replace('.', ',');
  const reason = params.reason || (lang === 'en' ? 'Non-compliant' : lang === 'mg' ? 'Tsy mifanaraka' : 'Non conforme');

  if (params.isAccepted) {
    if (lang === 'en') {
      const actor = params.isBot
        ? 'Your Facebook account has been automatically verified successfully.'
        : 'Your Facebook account has been accepted by the administrator.';
      return `✅ Account verified\n\n${actor}\n💰 +$${params.rewardUSD?.toFixed(2) || '0.04'} added to your balance.\n\n💵 Current balance : $${params.currentBalance.toFixed(2)}`;
    } else if (lang === 'mg') {
      const actor = params.isBot
        ? 'Voamarina soa aman-tsara ny kaonty Facebook-nao.'
        : "Nekena soa aman-tsara ny kaonty Facebook-nao nataon'ny mpandrindra.";
      return `✅ Kaonty voamarina\n\n${actor}\n💰 +${rewardStr} $ nampidirina tamin'ny solde-nao.\n\n💵 Solde ankehitriny : ${balanceStr} $`;
    } else {
      // Default: French (FR)
      const actor = params.isBot
        ? 'Votre compte Facebook a été vérifié avec succès.'
        : "Votre compte Facebook a été accepté par l'administrateur.";
      return `✅ Compte vérifié\n\n${actor}\n💰 +${rewardStr} $ ajouté à votre solde.\n\n💵 Solde actuel : ${balanceStr} $`;
    }
  } else {
    // REJECTED / SUSPENDED
    if (params.isBot) {
      if (lang === 'en') {
        return `❌ Verification failed\n\nYour Facebook account could not be verified automatically.\nStatus : Account suspended.\n\nReason : ${reason}`;
      } else if (lang === 'mg') {
        return `❌ Tsy nahomby ny fanamarinana\n\nTsy afaka nohamarinina ho azy ny kaonty Facebook-nao.\nToerana : Kaonty naato.\n\nAntony : ${reason}`;
      } else {
        return `❌ Vérification échouée\n\nVotre compte Facebook n'a pas pu être vérifié automatiquement.\nStatut : Compte suspendu.\n\nMotif : ${reason}`;
      }
    } else {
      // Admin rejection
      if (lang === 'en') {
        return `❌ Account rejected\n\nYour Facebook account was not accepted.\nReason : ${reason}\n\n💵 Current balance : $${params.currentBalance.toFixed(2)}`;
      } else if (lang === 'mg') {
        return `❌ Kaonty nolavina\n\nTsy nekena ny kaonty Facebook-nao.\nAntony : ${reason}\n\n💵 Solde ankehitriny : ${balanceStr} $`;
      } else {
        return `❌ Compte refusé\n\nVotre compte Facebook n'a pas été accepté.\nMotif : ${reason}\n\n💵 Solde actuel : ${balanceStr} $`;
      }
    }
  }
}

/**
 * Sends a real-time verification notification to the user via Telegram and records in-app notification.
 */
export async function sendTelegramVerificationMessage(
  telegramUserId: string | number,
  params: {
    isAccepted: boolean;
    isBot: boolean;
    rewardUSD?: number;
    currentBalance: number;
    reason?: string;
    language?: string;
    botToken?: string;
  }
): Promise<boolean> {
  const tgIdStr = String(telegramUserId).trim();
  if (!tgIdStr) return false;

  try {
    // 1. Determine user language if not passed
    let lang = params.language;
    let userId: number | null = null;
    try {
      const userRes = await pool.query(
        `SELECT id, language FROM users WHERE telegram_user_id = $1`,
        [tgIdStr]
      );
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
        if (!lang) lang = userRes.rows[0].language;
      }
    } catch (e) {
      // ignore
    }

    const message = formatVerificationMessage({
      ...params,
      language: lang || 'fr'
    });

    // 2. Insert in-app notification
    if (userId) {
      const title = params.isAccepted ? '✅ Compte vérifié' : '❌ Compte refusé';
      await createNotification(userId, title, message, params.isAccepted ? 'reward' : 'warning');
    }

    // 3. Send via Telegram Bot API
    const token = params.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgIdStr,
            text: message
          })
        });
        if (!response.ok) {
          const errText = await response.text();
          console.warn(`⚠️ Telegram sendMessage HTTP ${response.status}:`, errText);
          return false;
        }
        return true;
      } catch (tgErr: any) {
        console.warn('⚠️ Could not send Telegram message:', tgErr.message);
        return false;
      }
    }

    return true;
  } catch (err: any) {
    console.error('❌ Failed in sendTelegramVerificationMessage:', err.message);
    return false;
  }
}

/**
 * Sends a multilingual withdrawal lifecycle notification to the user via Telegram and in-app
 */
export async function sendTelegramWithdrawalNotification(params: {
  userId: number;
  telegramUserId?: string;
  withdrawalId: number;
  amount: number;
  method: string;
  destination: string;
  action: string;
  notes?: string;
  botToken?: string;
}): Promise<boolean> {
  try {
    let tgId = params.telegramUserId;
    let lang = 'fr';

    if (!tgId || !lang) {
      const userRes = await pool.query(`SELECT telegram_user_id, language FROM users WHERE id = $1`, [params.userId]);
      if (userRes.rows.length > 0) {
        tgId = tgId || userRes.rows[0].telegram_user_id;
        lang = userRes.rows[0].language || 'fr';
      }
    }

    const amountStr = params.amount.toFixed(2);
    let title = '';
    let message = '';

    if (params.action === 'approved') {
      if (lang === 'en') {
        title = '✅ Withdrawal approved';
        message = `✅ *Withdrawal approved*\n\nYour withdrawal request #${params.withdrawalId} of $${amountStr} USD via ${params.method} (${params.destination}) has been approved by admin. Payment is being scheduled.`;
      } else if (lang === 'mg') {
        title = '✅ Fangatahana nankatoavina';
        message = `✅ *Fangatahana nankatoavina*\n\nNekena ny fangatahanao fisintahana vola #${params.withdrawalId} mitentina $${amountStr} USD (${params.method} mankany ${params.destination}). Eo am-panomanana ny fandoavana.`;
      } else {
        title = '✅ Retrait approuvé';
        message = `✅ *Retrait approuvé*\n\nVotre demande de retrait #${params.withdrawalId} de $${amountStr} USD (${params.method} vers ${params.destination}) a été approuvée. Le paiement est en cours de préparation.`;
      }
    } else if (params.action === 'paid') {
      if (lang === 'en') {
        title = '🎉 Withdrawal paid successfully';
        message = `🎉 *Withdrawal paid!*\n\nYour withdrawal #${params.withdrawalId} of $${amountStr} USD has been sent to your ${params.method} account (${params.destination}).\n\nThank you for your valuable work!`;
      } else if (lang === 'mg') {
        title = '🎉 Voaloa soa aman-tsara ny vola';
        message = `🎉 *Voaloa soa aman-tsara ny fisintahana vola!*\n\nLasa soa aman-tsara ny volanao #${params.withdrawalId} mitentina $${amountStr} USD mankany amin'ny ${params.method} (${params.destination}).\n\nMisaotra betsaka tamin'ny ezaka nataonao !`;
      } else {
        title = '🎉 Retrait payé avec succès !';
        message = `🎉 *Retrait payé avec succès !*\n\nVotre retrait #${params.withdrawalId} de $${amountStr} USD a été envoyé vers votre compte ${params.method} (${params.destination}).\n\nMerci pour votre travail !`;
      }
    } else if (params.action === 'rejected' || params.action === 'cancelled') {
      const reason = params.notes || (lang === 'en' ? 'Administrative check' : lang === 'mg' ? 'Fanaraha-maso' : 'Vérification administrative');
      if (lang === 'en') {
        title = '❌ Withdrawal rejected';
        message = `❌ *Withdrawal rejected*\n\nYour withdrawal #${params.withdrawalId} of $${amountStr} USD was rejected.\n*Reason*: ${reason}\n\n💰 *Refund*: $${amountStr} USD has been refunded back to your available balance.`;
      } else if (lang === 'mg') {
        title = '❌ Nolavina ny fisintahana vola';
        message = `❌ *Nolavina ny fisintahana vola*\n\nNolavina ny fangatahanao #${params.withdrawalId} mitentina $${amountStr} USD.\n*Antony*: ${reason}\n\n💰 *Famerenam-bola*: Naverina feno ao amin'ny solde-nao ny $${amountStr} USD.`;
      } else {
        title = '❌ Retrait rejeté';
        message = `❌ *Retrait rejeté*\n\nVotre retrait #${params.withdrawalId} de $${amountStr} USD a été rejeté.\n*Motif*: ${reason}\n\n💰 *Remboursement*: Les $${amountStr} USD ont été intégralement réintégrés à votre solde disponible.`;
      }
    }

    if (title && message) {
      await createNotification(params.userId, title, message.replace(/\*/g, ''), params.action === 'paid' ? 'reward' : params.action === 'approved' ? 'info' : 'warning');
    }

    const token = params.botToken || process.env.TELEGRAM_BOT_TOKEN;
    if (token && tgId) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgId,
            text: message,
            parse_mode: 'Markdown'
          })
        });
      } catch (tgErr: any) {
        console.warn('⚠️ Could not send Telegram withdrawal update:', tgErr.message);
      }
    }

    return true;
  } catch (err: any) {
    console.error('❌ Failed in sendTelegramWithdrawalNotification:', err.message);
    return false;
  }
}
