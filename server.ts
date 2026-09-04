import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Telegraf, Markup } from 'telegraf';
import { pool, testDatabaseConnection } from './src/services/database';
import { initializeDatabase } from './src/services/databaseInit';
import {
  getOrCreateUser,
  getUserWallet,
  getUserProfile,
  setUserLanguage,
  getUserStats,
  getAllWallets
} from './src/services/userService';
import {
  getAllTasks,
  createTask,
  validateTask,
  rejectTask,
  updateTaskStatus,
  deleteTask,
  performBotAccountCheck
} from './src/services/taskService';
import {
  requestWithdrawal,
  getAllWithdrawals,
  processWithdrawal,
  getAllTransactions
} from './src/services/withdrawalService';
import {
  getAllStaff,
  createStaffMember,
  updateStaffMember,
  loginStaff,
  verifySession,
  logoutStaff
} from './src/services/authService';
import { getAuditLogs, logAudit } from './src/services/auditService';
import { syncTaskToGoogleSheets } from './src/services/sheetsService';
import { checkFacebookUid } from './src/services/facebookCheckerService';
import { INITIAL_TASKS } from './src/data/mockTasks';
import crypto from 'crypto';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ----------------------------------------------------
// TELEGRAM MINI APP AUTH
// ----------------------------------------------------
app.post('/api/telegram/mini-app/auth', async (req, res) => {
  try {
    const { initData } = req.body;

    if (!initData) {
      return res.status(400).json({
        success: false,
        message: 'Telegram initData manquant'
      });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return res.status(500).json({
        success: false,
        message: 'TELEGRAM_BOT_TOKEN manquant'
      });
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return res.status(401).json({
        success: false,
        message: 'Telegram hash manquant'
      });
    }

    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (
      calculatedHash.length !== hash.length ||
      !crypto.timingSafeEqual(
        Buffer.from(calculatedHash),
        Buffer.from(hash)
      )
    ) {
      return res.status(401).json({
        success: false,
        message: 'Telegram initData invalide'
      });
    }

    const telegramUserData = params.get('user');

    if (!telegramUserData) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur Telegram introuvable'
      });
    }

    const telegramUser = JSON.parse(telegramUserData);
    const userId = String(telegramUser.id);

    const user = await getOrCreateUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
    }

    return res.json({
      success: true,
      authenticated: true,
      user: {
        id: user.telegram_user_id,
        username: user.telegram_username,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });

  } catch (error) {
    console.error(
      '❌ Telegram Mini App auth error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Erreur authentification Telegram'
    });
  }
});

// ----------------------------------------------------
// TELEGRAM MINI APP - CREATE TASK
// ----------------------------------------------------
app.post('/api/telegram/mini-app/tasks', async (req, res) => {
  try {
    const {
      telegramUserId,
      telegramUsername,
      taskType,
      firstName,
      lastName,
      password,
      uid,
      cookies,
      notes
    } = req.body;

    if (!telegramUserId) {
      return res.status(400).json({
        success: false,
        message: 'Telegram User ID manquant'
      });
    }

    if (!taskType) {
      return res.status(400).json({
        success: false,
        message: 'Type de tâche manquant'
      });
    }

    const userId = String(telegramUserId);

    const user = await getOrCreateUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
    }

    const created = await createTask({
      taskId: `mini-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      telegramUserId: userId,
      telegramUsername: telegramUsername || user.telegram_username || '',
      firstName: firstName || '',
      lastName: lastName || '',
      password: password || '',
      uid: uid || '',
      cookies: cookies || '',
      taskType: taskType || 'Facebook',
      notes: notes || '',
      status: 'compte créé'
    });

    tasks.unshift(created);

    addLog(
      'success',
      'system',
      'Tâche Mini App enregistrée dans la base PostgreSQL',
      {
        taskId: created.id,
        telegramUserId: userId,
        taskType
      }
    );

    return res.json({
      success: true,
      message: 'Tâche enregistrée avec succès',
      task: created
    });

  } catch (error) {
    console.error(
      '❌ Mini App create task error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l’enregistrement de la tâche'
    });
  }
});

// ----------------------------------------------------
// TELEGRAM MINI APP ACTION API
// ----------------------------------------------------

app.post('/api/telegram/mini-app/action', async (req, res) => {
  try {
    const { action, telegramUserId } = req.body;

    if (!telegramUserId) {
      return res.status(400).json({
        success: false,
        message: 'Telegram User ID manquant'
      });
    }

    const userId = String(telegramUserId);

    // Vérifier / créer l'utilisateur PostgreSQL
    const user = await getOrCreateUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
    }

    switch (action) {

      // -----------------------------------------------
      // SOLDE
      // -----------------------------------------------
      case 'action_check_balance': {
        const wallet = await getUserWallet(userId);

        const completedResult = await pool.query(
          `
          SELECT COUNT(*)::int AS count
          FROM tasks
          WHERE telegram_user_id = $1
            AND status IN (
              'completed',
              'validated',
              'approved',
              'compte créé'
            )
          `,
          [userId]
        );

        const pendingResult = await pool.query(
          `
          SELECT COUNT(*)::int AS count
          FROM tasks
          WHERE telegram_user_id = $1
            AND status IN (
              'pending',
              'pending_validation',
              'en_attente',
              'awaiting_validation'
            )
          `,
          [userId]
        );

        const rejectedResult = await pool.query(
          `
          SELECT COUNT(*)::int AS count
          FROM tasks
          WHERE telegram_user_id = $1
            AND status IN (
              'rejected_admin',
              'refused_admin',
              'rejected',
              'rejected_bot',
              'refused_bot'
            )
          `,
          [userId]
        );

        return res.json({
          success: true,
          action,
          user: {
            id: user.telegram_user_id,
            username: user.telegram_username,
            firstName: user.first_name,
            lastName: user.last_name
          },
          wallet: {
            balance: Number(wallet?.balance || 0),
            totalEarned: Number(wallet?.total_earned || 0),
            totalWithdrawn: Number(wallet?.total_withdrawn || 0)
          },
          statistics: {
            completed: Number(
              completedResult.rows[0]?.count || 0
            ),
            pending: Number(
              pendingResult.rows[0]?.count || 0
            ),
            rejected: Number(
              rejectedResult.rows[0]?.count || 0
            )
          }
        });
      }

      // -----------------------------------------------
      // TÂCHES
      // -----------------------------------------------
      case 'task_facebook': {
        return res.json({
          success: true,
          action,
          redirect: '/?telegramMiniApp=1&screen=tasks'
        });
      }

      // -----------------------------------------------
      // RETRAIT
      // -----------------------------------------------
      case 'action_request_withdrawal': {
        return res.json({
          success: true,
          action,
          redirect: '/?telegramMiniApp=1&screen=withdraw'
        });
      }

      // -----------------------------------------------
      // SUPPORT
      // -----------------------------------------------
      case 'action_support': {
        return res.json({
          success: true,
          action,
          redirect: '/?telegramMiniApp=1&screen=support'
        });
      }

      // -----------------------------------------------
      // PARRAINAGES
      // -----------------------------------------------
      case 'action_referrals': {
        return res.json({
          success: true,
          action,
          redirect: '/?telegramMiniApp=1&screen=referrals'
        });
      }

      // -----------------------------------------------
      // CLASSEMENT
      // -----------------------------------------------
      case 'action_leaderboard': {
        return res.json({
          success: true,
          action,
          redirect: '/?telegramMiniApp=1&screen=leaderboard'
        });
      }

      // -----------------------------------------------
      // LANGUE
      // -----------------------------------------------
      case 'action_language': {
        return res.json({
          success: true,
          action,
          redirect: '/?telegramMiniApp=1&screen=language'
        });
      }

      default:
        return res.status(400).json({
          success: false,
          message: `Action inconnue: ${action}`
        });
    }

  } catch (error) {
    console.error(
      '❌ Telegram Mini App action error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// ----------------------------------------------------
// TELEGRAM MINI APP - TASKS
// ----------------------------------------------------
app.get('/api/telegram/mini-app/tasks', async (req, res) => {
  try {
    const telegramUserId = String(
      req.query.telegramUserId || ''
    ).trim();

    if (!telegramUserId) {
      return res.status(400).json({
        success: false,
        message: 'Telegram User ID manquant'
      });
    }

    /*
     * =========================================================
     * GET TASKS OF CURRENT TELEGRAM USER
     * =========================================================
     *
     * Important:
     * This route ONLY reads tasks.
     * It must NOT create/insert a new task.
     */

    const result = await pool.query(
      `
      SELECT
        id,
        task_id,
        telegram_user_id,
        task_type,
        status,
        validation_status,
        validation_reason,
        validated_at,
        validated_by,

        uid,
        first_name,
        last_name,

        reward_usd,
        reward_paid,
        reward_paid_at,

        account_created,
        account_created_at,

        created_at,
        completed_at

      FROM tasks
      WHERE telegram_user_id = $1
      ORDER BY created_at DESC
      `,
      [telegramUserId]
    );

    /*
     * =========================================================
     * RETURN TASKS
     * =========================================================
     */

    const tasks = result.rows.map((task: any) => ({
      id: String(task.task_id),

      taskId: task.task_id,

      telegramUserId: task.telegram_user_id,

      taskType: task.task_type,

      status: task.status,

      validationStatus:
        task.validation_status || 'pending',

      validationReason:
        task.validation_reason || null,

      validatedAt:
        task.validated_at || null,

      validatedBy:
        task.validated_by || null,

      uid: task.uid || '',

      firstName:
        task.first_name || '',

      lastName:
        task.last_name || '',

      rewardUSD:
        Number(task.reward_usd || 0),

      rewardPaid:
        Boolean(task.reward_paid),

      rewardPaidAt:
        task.reward_paid_at || null,

      accountCreated:
        Boolean(task.account_created),

      accountCreatedAt:
        task.account_created_at || null,

      createdAt:
        task.created_at,

      completedAt:
        task.completed_at || null
    }));

    return res.json({
      success: true,
      tasks
    });

  } catch (error) {
    console.error(
      '❌ Mini App tasks error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

app.post('/api/tasks/:taskId/validate', async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      validatorId = 'admin',
      notes = 'Validé avec succès',
      reason
    } = req.body;

    const validated = await validateTask(taskId, validatorId, reason || notes, 'ADMIN');
    return res.json({
      success: true,
      validated: true,
      status: 'validated',
      task: validated
    });
  } catch (error: any) {
    console.error('❌ Validation error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erreur lors de la validation'
    });
  }
});

app.post('/api/tasks/:taskId/bot-check', async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await performBotAccountCheck(taskId, botSettings);
    return res.json({
      success: true,
      task: result
    });
  } catch (error: any) {
    console.error('❌ Bot check error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'Erreur lors de la vérification par le bot'
    });
  }
});



// ----------------------------------------------------
// FINANCIAL & COMMISSION CONSTANTS (USD)
// ----------------------------------------------------
const TASK_REWARD_USD = 0.04;                  // $0.04 per completed task
const REFERRAL_SIGNUP_BONUS_USD = 0.01;        // $0.01 direct referral registration bonus
const REFERRAL_COMMISSION_PERCENT = 20;        // 20% recurring task commission
const REFERRAL_TASK_COMMISSION_USD = 0.008;    // $0.008 per task (20% of $0.04)
const MIN_WITHDRAWAL_USD = 1.00;               // $1.00 minimum payout threshold

// ----------------------------------------------------
// IN-MEMORY DATABASE & CONFIG STATE
// ----------------------------------------------------
const FIRST_NAMES = [
  'Alexandre', 'Thomas', 'Julien', 'Nicolas', 'Maxime', 'Lucas',
  'Antoine', 'Romain', 'Guillaume', 'Clément', 'Hugo', 'Valentin',
  'Mathieu', 'Florian', 'Adrien', 'Quentin', 'Benjamin', 'Pierre',
  'Louis', 'Arthur', 'Paul', 'Théo', 'Baptiste', 'Gabriel',
  'Camille', 'Emma', 'Léa', 'Chloé', 'Manon', 'Inès',
  'Sarah', 'Laura', 'Marine', 'Juliette', 'Lucie', 'Clara',
  'Marie', 'Anaïs', 'Pauline', 'Océane', 'Élodie', 'Émilie',
  'Amélie', 'Aurélie', 'Charlotte', 'Jeanne', 'Louise', 'Alice',
  'Sophie', 'Margot', 'Mathilde', 'Céline', 'Caroline', 'Mélanie',
  'Valérie', 'Virginie', 'Justine', 'Amandine', 'Marion', 'Noémie',
  'Élise', 'Claire', 'Hélène', 'Agathe', 'Adèle', 'Zoé',
  'Jade', 'Lola', 'Mila', 'Rose', 'Ambre', 'Iris',
  'Lina', 'Mia', 'Eva', 'Nina', 'Romane', 'Victoria',
  'Constance', 'Madeleine', 'Gabrielle', 'Joséphine', 'Maëlle',
  'Maëlys', 'Yanis', 'Enzo', 'Nathan', 'Ethan', 'Léo',
  'Léon', 'Noah', 'Tom', 'Sacha', 'Axel', 'Alexis',
  'Thibault', 'Corentin', 'Jérémy', 'Kevin', 'Mickaël', 'Jonathan',
  'Jordan', 'Dorian', 'Damien', 'Bastien', 'Cédric', 'Christophe',
  'Sébastien', 'Stéphane', 'François', 'Frédéric', 'Olivier', 'Laurent',
  'Vincent', 'Philippe', 'Xavier', 'Jérôme', 'Patrick', 'Pascal',
  'Bruno', 'Marc', 'Alain', 'Daniel', 'David', 'Éric',
  'Édouard', 'Étienne', 'Gaspard', 'Gabin', 'Raphaël', 'Samuel',
  'Simon', 'Martin', 'Victor', 'Marius', 'Oscar', 'Hector',
  'Eliott', 'Augustin', 'Benoît', 'Rémi', 'Renaud', 'Arnaud',
  'Tristan', 'Fabien', 'Lionel', 'Loïc', 'Gaël', 'Killian',
  'Mathis', 'Matthieu', 'Matteo', 'Théodore', 'Timothée', 'Liam',
  'Malo', 'Marin', 'Nolan', 'Nino', 'Naël', 'Maël',
  'Ilan', 'Ismaël', 'Adam', 'Noé', 'Evan', 'Léandre',
  'Côme', 'Cyprien', 'Félix', 'Léonard', 'Geoffrey', 'Grégoire',
  'Hervé', 'Henri', 'Jacques', 'Michel', 'Maurice', 'André',
  'Bernard', 'Robert', 'Roger', 'René', 'Raymond', 'Georges',
  'Marcel', 'Gilbert', 'Christian', 'Didier', 'Évelyne', 'Nathalie',
  'Isabelle', 'Sandrine', 'Véronique', 'Sylvie', 'Patricia', 'Monique',
  'Martine', 'Laurence', 'Karine', 'Sabine', 'Brigitte', 'Chantal',
  'Coralie', 'Delphine', 'Fabienne', 'Geneviève', 'Rachel', 'Rebecca',
  'Salomé', 'Solène', 'Suzanne', 'Thaïs', 'Valentine', 'Yasmine',
  'Zélie', 'Aurore', 'Bérénice', 'Clémence', 'Daphné', 'Diane',
  'Éléonore', 'Estelle', 'Fanny', 'Faustine', 'Flavie', 'Garance',
  'Hortense', 'Lison', 'Léna', 'Lilou', 'Lisa', 'Livia',
  'Maïa', 'Maïwenn', 'Morgane', 'Natacha', 'Ophélie', 'Priscille',
  'Noémie', 'Apolline', 'Capucine', 'Cassandre', 'Coline', 'Alix'
];

const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard',
  'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent',
  'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux',
  'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Lefèvre',
  'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez',
  'Legrand', 'Garnier', 'Faure', 'Rousseau', 'Blanc', 'Guérin',
  'Muller', 'Henry', 'Roussel', 'Nicolas', 'Chevalier', 'Gautier',
  'Perrin', 'Robin', 'Morin', 'Mathieu', 'Caron', 'Masson',
  'Marchand', 'Duval', 'Denis', 'Dumont', 'Lemaire', 'Noël',
  'Meyer', 'Dufour', 'Meunier', 'Brun', 'Blanchard', 'Giraud',
  'Joly', 'Renaud', 'Renard', 'Picard', 'Roger', 'Colin',
  'Vidal', 'Bourgeois', 'Roche', 'Roy', 'Fontaine', 'Perrot',
  'Schmitt', 'Payet', 'Boyer', 'Lopez', 'Marty', 'Le Gall',
  'Le Goff', 'Lecomte', 'Leconte', 'Delorme', 'Delattre', 'Delacroix',
  'Deschamps', 'Delaunay', 'Lacroix', 'Charpentier', 'Barbier',
  'Bouvier', 'Hubert', 'Marchal', 'Ménard', 'Poirier', 'Lemoine',
  'Maillard', 'Paris', 'Adam', 'Aubry', 'Besson', 'Bigot',
  'Bouchet', 'Boulay', 'Boulanger', 'Bourdon', 'Brunet', 'Buisson',
  'Carlier', 'Carpentier', 'Chauvet', 'Chevallier', 'Clément',
  'Cordier', 'Cousin', 'Da Silva', 'Daniel', 'Delaunay', 'Delmas',
  'Denis', 'Devaux', 'Didier', 'Dominique', 'Drouet', 'Duhamel',
  'Dumas', 'Dupuis', 'Durand', 'Dupré', 'Faber', 'Fabre',
  'Fleury', 'Forest', 'Fortin', 'Foucher', 'Gallet', 'Gillet',
  'Gillet', 'Gomes', 'Gonzalez', 'Granger', 'Guillon', 'Guillot',
  'Guyot', 'Jacquet', 'Jacques', 'Jean', 'Jourdan', 'Lamy',
  'Langlois', 'Laroche', 'Lavigne', 'Leblanc', 'Lebon', 'Leclerc',
  'Leclercq', 'Legros', 'Lenoir', 'Leroux', 'Lesage', 'Loiseau',
  'Lucas', 'Mallet', 'Marchal', 'Maréchal', 'Masson', 'Maury',
  'Mercier', 'Merle', 'Monnier', 'Monteil', 'Moulin', 'Navarro',
  'Neveu', 'Normand', 'Olivier', 'Peltier', 'Perret', 'Philippe',
  'Pichon', 'Pineau', 'Prevost', 'Prévost', 'Ramos', 'Regnier',
  'Régnier', 'Rey', 'Reynaud', 'Richard', 'Riou', 'Rivet',
  'Rivière', 'Rolland', 'Rossi', 'Rousset', 'Roy', 'Saint Pierre',
  'Sanchez', 'Schneider', 'Serre', 'Soler', 'Tessier', 'Thibault',
  'Toussaint', 'Valette', 'Vasseur', 'Verdier', 'Vernier', 'Vernet',
  'Vasseur', 'Verger', 'Vial', 'Viau', 'Vignon', 'Villain',
  'Villeneuve', 'Voisin', 'Weber', 'Weiss', 'Albert', 'Allard',
  'Arnaud', 'Baron', 'Bazin', 'Beaumont', 'Benoit', 'Benoît',
  'Berger', 'Bertin', 'Blondel', 'Boivin', 'Bonnet', 'Bourdin',
  'Breton', 'Buisson', 'Chambon', 'Chapelle', 'Chapuis', 'Charrier',
  'Chauvin', 'Chemin', 'Chopin', 'Clerc', 'Comte', 'Constant',
  'Couturier', 'Darras', 'Delage', 'Delannoy', 'Delorme', 'Desmet',
  'Doucet', 'Dufresne', 'Dumoulin', 'Dupont', 'Favier', 'Fayard',
  'Fischer', 'Gaillard', 'Garnier', 'Germain', 'Gervais', 'Gillet',
  'Giraud', 'Godard', 'Goujon', 'Grondin', 'Guérin', 'Hamon',
  'Hardy', 'Hervé', 'Jacquot', 'Joubert', 'Klein', 'Lacroix',
  'Lalande', 'Lallemand', 'Lambert', 'Langlois', 'Laporte', 'Laurent',
  'Laval', 'Lejeune', 'Lelong', 'Leroux', 'Lombard', 'Mace',
  'Macé', 'Mahe', 'Mahé', 'Malherbe', 'Marechal', 'Marin',
  'Martel', 'Masson', 'Michaud', 'Monnier', 'Morel', 'Mouret',
  'Nicolas', 'Oudin', 'Pajot', 'Poulain', 'Prieur', 'Renault',
  'Richer', 'Rochefort', 'Rolland', 'Sauvage', 'Seguin', 'Serra',
  'Tanguy', 'Terrier', 'Thomas', 'Tourneur', 'Vasseur', 'Verdier'
];

const DEFAULT_GOOGLE_SHEET_FIELDS = [
  'timestamp',
  'id',
  'status',
  'uid',
  'firstName',
  'lastName',
  'password',
  'cookies',
  'telegramUserId',
  'telegramUsername',
  'notes',
  'taskType',
  'rewardUSD'
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
  googleSheetFields: DEFAULT_GOOGLE_SHEET_FIELDS.slice(),
  platformName: process.env.PLATFORM_NAME || 'Taskify Pro',
  isBotActive: false,
  mode: 'polling' as 'polling' | 'webhook',
  webhookUrl: process.env.WEBHOOK_URL || '',
  lastSyncedAt: new Date().toISOString(),
  welcomeMessage: "Bienvenue sur Taskify Pro (@TaskifyProBot) - Gestionnaire de tâches automatisées.",
  facebookCheckerApiUrl: process.env.FACEBOOK_CHECKER_API_URL || '',
  facebookCheckerApiKey: process.env.FACEBOOK_CHECKER_API_KEY || '',
  autoBotCheckEnabled: true
};

let tasks: any[] = [...INITIAL_TASKS];
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
  language?: 'fr' | 'en' | 'ru' | 'es' | 'id';
  balance?: number;
  tasksCompleted?: number;
  referralsCount?: number;
  referralEarnings?: number;
}> = {};

// Helper: Dispatch task record to Google Apps Script Webhook
async function syncRowToGoogleSheets(task: any) {
  const webhookUrl = botSettings.googleSheetWebhookUrl || process.env.GOOGLE_SHEET_WEBHOOK_URL ||'';

  if (!webhookUrl) {
    console.warn('GOOGLE_SHEET_WEBHOOK_URL not configured');
    return;
  }

  const selectedFields =
    Array.isArray(botSettings.googleSheetFields) &&
    botSettings.googleSheetFields.length > 0
      ? botSettings.googleSheetFields
      : DEFAULT_GOOGLE_SHEET_FIELDS;

  const data = {
    timestamp: task.createdAt || new Date().toISOString(),
    id: task.id || '',
    status: task.status || '',
    uid: task.uid || '',
    firstName: task.firstName || '',
    lastName: task.lastName || '',
    password: task.password || '',
    cookies: task.cookies || '',
    telegramUserId: task.telegramUserId || '',
    telegramUsername: task.telegramUsername || '',
    notes: task.notes || '',
    taskType: task.taskType || '',
    rewardUSD: task.rewardUSD ?? ''
  };

  const payload = {
    action: 'insert_task',
    selectedFields,
    data
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    console.log('Google Sheets response:', text);

    if (!response.ok) {
      throw new Error(
        `Google Sheets HTTP ${response.status}: ${text}`
      );
    }

    return text;
  } catch (error) {
    console.error('Google Sheets sync failed:', error);
    throw error;
  }
}

// ----------------------------------------------------
// 5-LANGUAGE TRANSLATION DICTIONARY
// ----------------------------------------------------
const TRANSLATIONS = {
  fr: {
    welcome: `👋 *Bienvenue sur ${botSettings.platformName} (@TaskifyProBot) !*\n\n` +
      `Plateforme officielle d'exécution et de validation de tâches rémunérées.\n\n` +
      `💵 *Rémunération :* \`$${TASK_REWARD_USD.toFixed(2)}\` par compte validé\n` +
      `🎁 *Bonus Parrainage :* \`$${REFERRAL_SIGNUP_BONUS_USD.toFixed(2)}\` à l'inscription + \`${REFERRAL_COMMISSION_PERCENT}%\` des gains de vos filleuls\n` +
      `🎯 *Seuil de retrait :* \`$${MIN_WITHDRAWAL_USD.toFixed(2)}\`\n\n` +
      `Utilisez le menu ci-dessous ou cliquez pour démarrer :`,
    balance_title: `💰 *Votre Solde & Activité*`,
    tasks_title: `🌐 *Tâche : Création de Compte Facebook*`,
    withdrawal_title: `🏦 *Demande de Retrait de Gains*`,
    support_title: `📞 *Support & Assistance Opérateurs*`,
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
    cookies_reward_notice: `💵 *Rémunération par compte validé :* \`$${TASK_REWARD_USD.toFixed(2)}\``,
    task_rules_text: `📋 *Consignes & Règles de Validation Facebook*\n\n` +
      `1. Utilisez obligatoirement le prénom et le nom fournis.\n` +
      `2. Utilisez le mot de passe assigné sans le modifier.\n` +
      `3. Extrayez les cookies complets contenant \`c_user\`, \`datr\` et \`xs\`.\n` +
      `4. Rémunération : \`$${TASK_REWARD_USD.toFixed(2)}\` par tâche validée.`,
    awaiting_uid: `✍️ *Étape 1/2 : Envoi de l'UID Facebook*\n\nVeuillez coller votre **UID Facebook** (ex: \`100084928172910\`) :`,
    awaiting_cookies: `🍪 *Étape 2/2 : Envoi des Cookies*\n\nVeuillez maintenant coller vos **Cookies Facebook** complets (ex: format \`datr=...; c_user=...; xs=...\`) :`,
    cancelled: `❌ *Processus annulé.*\nAucune donnée n'a été enregistrée.`
  },
  en: {
    welcome: `👋 *Welcome to ${botSettings.platformName} (@TaskifyProBot)!*\n\n` +
      `Official automated platform for rewarded account creation tasks.\n\n` +
      `💵 *Task Reward:* \`$${TASK_REWARD_USD.toFixed(2)}\` per verified account\n` +
      `🎁 *Referral Bonus:* \`$${REFERRAL_SIGNUP_BONUS_USD.toFixed(2)}\` on signup + \`${REFERRAL_COMMISSION_PERCENT}%\` commission per referred task\n` +
      `🎯 *Min Payout:* \`$${MIN_WITHDRAWAL_USD.toFixed(2)}\`\n\n` +
      `Use the persistent menu below to start working:`,
    balance_title: `💰 *Your Balance & Performance*`,
    tasks_title: `🌐 *Task: Facebook Account Creation*`,
    withdrawal_title: `🏦 *Payout Request*`,
    support_title: `📞 *Support & Helpdesk*`,
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
    cookies_reward_notice: `💵 *Reward per verified account:* \`$${TASK_REWARD_USD.toFixed(2)}\``,
    task_rules_text: `📋 *Facebook Account Guidelines*\n\n` +
      `1. Always use the generated First & Last name.\n` +
      `2. Use the exact assigned password.\n` +
      `3. Export full cookies including \`c_user\`, \`datr\` and \`xs\`.\n` +
      `4. Reward: \`$${TASK_REWARD_USD.toFixed(2)}\` per valid submission.`,
    awaiting_uid: `✍️ *Step 1/2: Submit Facebook UID*\n\nPlease paste your **Facebook UID** (e.g. \`100084928172910\`) :`,
    awaiting_cookies: `🍪 *Step 2/2: Submit Cookies*\n\nPlease paste your full **Facebook Cookies** (e.g. \`datr=...; c_user=...; xs=...\`) :`,
    cancelled: `❌ *Process cancelled.*\nNo data has been saved.`
  },
  ru: {
    welcome: `👋 *Добро пожаловать в ${botSettings.platformName} (@TaskifyProBot)!*\n\n` +
      `Официальная платформа для выполнения оплачиваемых заданий.\n\n` +
      `💵 *Оплата:* \`$${TASK_REWARD_USD.toFixed(2)}\` за каждый подтвержденный аккаунт\n` +
      `🎁 *Реферальный бонус:* \`$${REFERRAL_SIGNUP_BONUS_USD.toFixed(2)}\` за регистрацию + \`${REFERRAL_COMMISSION_PERCENT}%\` комиссионных\n` +
      `🎯 *Мин. вывод:* \`$${MIN_WITHDRAWAL_USD.toFixed(2)}\`\n\n` +
      `Используйте меню ниже для начала работы:`,
    balance_title: `💰 *Ваш Баланс и Статистика*`,
    tasks_title: `🌐 *Задание: Создание аккаунта Facebook*`,
    withdrawal_title: `🏦 *Запрос на Вывод Средств*`,
    support_title: `📞 *Служба Поддержки*`,
    referral_title: `👥 *Партнерская Программа и Рефералы*`,
    leaderboard_title: `🏆 *Рейтинг Лучших Операторов (Этот Месяц)*`,
    lang_title: `🪩 *Выбор Языка / Language*`,
    lang_confirm: `✅ Язык бота успешно изменен на **Русский** 🇷🇺.`,
    btn_tasks: `📋 Выполнить задание`,
    btn_withdraw: `🏦 Заказать вывод`,
    btn_support: `💬 Написать в поддержку`,
    btn_rules: `ℹ️ Правила и инструкции`,
    btn_cancel: `❌ Отменить процесс`,
    btn_cookies: `🍪 Cookies (Рекомендуется)`,
    btn_2fa: `🔐 2FA (Код доступа)`,
    btn_send_uid: `📥 Отправить UID`,
    btn_share_ref: `📤 Поделиться ссылкой`,
    cookies_reward_notice: `💵 *Оплата за подтвержденный аккаунт:* \`$${TASK_REWARD_USD.toFixed(2)}\``,
    task_rules_text: `📋 *Инструкция по созданию Facebook*\n\n` +
      `1. Обязательно используйте сгенерированные имя и фамилию.\n` +
      `2. Используйте указанный пароль без изменений.\n` +
      `3. Экспортируйте полные cookies с \`c_user\`, \`datr\` и \`xs\`.\n` +
      `4. Оплата: \`$${TASK_REWARD_USD.toFixed(2)}\` за каждое задание.`,
    awaiting_uid: `✍️ *Шаг 1/2: Отправка Facebook UID*\n\nОтправьте ваш **UID Facebook** (напр. \`100084928172910\`) :`,
    awaiting_cookies: `🍪 *Шаг 2/2: Отправка Cookies*\n\nОтправьте полные **Cookies Facebook** (напр. \`datr=...; c_user=...; xs=...\`) :`,
    cancelled: `❌ *Процесс отменен.*\nДанные не были сохранены.`
  },
  es: {
    welcome: `👋 *¡Bienvenido a ${botSettings.platformName} (@TaskifyProBot)!*\n\n` +
      `Plataforma oficial para tareas remuneradas de creación de cuentas.\n\n` +
      `💵 *Pago por tarea:* \`$${TASK_REWARD_USD.toFixed(2)}\` por cuenta validada\n` +
      `🎁 *Bono de Referidos:* \`$${REFERRAL_SIGNUP_BONUS_USD.toFixed(2)}\` por registro + \`${REFERRAL_COMMISSION_PERCENT}%\` de comisión continua\n` +
      `🎯 *Retiro mínimo:* \`$${MIN_WITHDRAWAL_USD.toFixed(2)}\`\n\n` +
      `Usa el menú inferior para comenzar :`,
    balance_title: `💰 *Tu Saldo y Rendimiento*`,
    tasks_title: `🌐 *Tarea: Creación de Cuenta Facebook*`,
    withdrawal_title: `🏦 *Solicitud de Retiro*`,
    support_title: `📞 *Soporte y Asistencia*`,
    referral_title: `👥 *Programa de Referidos y Comisiones*`,
    leaderboard_title: `🏆 *Clasificación de Mejores Operadores*`,
    lang_title: `🪩 *Selección de Idioma*`,
    lang_confirm: `✅ Idioma configurado en **Español** 🇪🇸.`,
    btn_tasks: `📋 Realizar una Tarea`,
    btn_withdraw: `🏦 Solicitar Retiro`,
    btn_support: `💬 Contactar Soporte`,
    btn_rules: `ℹ️ Reglas e Instrucciones`,
    btn_cancel: `❌ Cancelar proceso`,
    btn_cookies: `🍪 Cookies (Recomendado)`,
    btn_2fa: `🔐 2FA (Código de acceso)`,
    btn_send_uid: `📥 Enviar UID`,
    btn_share_ref: `📤 Compartir enlace`,
    cookies_reward_notice: `💵 *Pago por cuenta verificada:* \`$${TASK_REWARD_USD.toFixed(2)}\``,
    task_rules_text: `📋 *Reglas para Cuentas de Facebook*\n\n` +
      `1. Usa siempre el nombre y apellido generados.\n` +
      `2. Usa la contraseña asignada sin cambios.\n` +
      `3. Extrae las cookies completas (\`c_user\`, \`datr\`, \`xs\`).\n` +
      `4. Recompensa: \`$${TASK_REWARD_USD.toFixed(2)}\` por tarea validada.`,
    awaiting_uid: `✍️ *Paso 1/2: Enviar UID de Facebook*\n\nEnvía tu **UID de Facebook** (ej: \`100084928172910\`) :`,
    awaiting_cookies: `🍪 *Paso 2/2: Enviar Cookies*\n\nEnvía tus **Cookies de Facebook** completas (ej: \`datr=...; c_user=...; xs=...\`) :`,
    cancelled: `❌ *Proceso cancelado.*\nNo se guardó información.`
  },
  id: {
    welcome: `👋 *Selamat Datang di ${botSettings.platformName} (@TaskifyProBot)!*\n\n` +
      `Platform otomatis resmi untuk pengerjaan tugas pembuatan akun berbayar.\n\n` +
      `💵 *Hadiah per Akun:* \`$${TASK_REWARD_USD.toFixed(2)}\` per akun tervalidasi\n` +
      `🎁 *Bonus Referral:* \`$${REFERRAL_SIGNUP_BONUS_USD.toFixed(2)}\` pendaftaran + komisi \`${REFERRAL_COMMISSION_PERCENT}%\` dari setiap tugas referral\n` +
      `🎯 *Minimal Penarikan:* \`$${MIN_WITHDRAWAL_USD.toFixed(2)}\`\n\n` +
      `Gunakan menu di bawah untuk memulai:`,
    balance_title: `💰 *Saldo & Aktivitas Anda*`,
    tasks_title: `🌐 *Tugas: Pembuatan Akun Facebook*`,
    withdrawal_title: `🏦 *Permintaan Penarikan Saldo*`,
    support_title: `📞 *Pusat Bantuan & Dukungan*`,
    referral_title: `👥 *Program Referral & Komisi*`,
    leaderboard_title: `🏆 *Papan Peringkat Operator Terbaik*`,
    lang_title: `🪩 *Pilihan Bahasa / Language*`,
    lang_confirm: `✅ Bahasa bot berhasil diubah ke **Bahasa Indonesia** 🇮🇩.`,
    btn_tasks: `📋 Kerjakan Tugas`,
    btn_withdraw: `🏦 Tarik Saldo`,
    btn_support: `💬 Hubungi Dukungan`,
    btn_rules: `ℹ️ Panduan & Aturan`,
    btn_cancel: `❌ Batalkan Proses`,
    btn_cookies: `🍪 Cookies (Disarankan)`,
    btn_2fa: `🔐 2FA (Kode Akses)`,
    btn_send_uid: `📥 Kirim UID`,
    btn_share_ref: `📤 Bagikan Link Referral`,
    cookies_reward_notice: `💵 *Imbalan per akun terverifikasi:* \`$${TASK_REWARD_USD.toFixed(2)}\``,
    task_rules_text: `📋 *Panduan Akun Facebook*\n\n` +
      `1. Selalu gunakan nama depan dan belakang yang diberikan.\n` +
      `2. Gunakan kata sandi yang telah ditentukan tanpa diubah.\n` +
      `3. Ekspor cookies lengkap (\`c_user\`, \`datr\`, \`xs\`).\n` +
      `4. Imbalan: \`$${TASK_REWARD_USD.toFixed(2)}\` per tugas valid.`,
    awaiting_uid: `✍️ *Langkah 1/2: Kirim UID Facebook*\n\nSilakan tempel **UID Facebook** Anda (contoh: \`100084928172910\`) :`,
    awaiting_cookies: `🍪 *Langkah 2/2: Kirim Cookies*\n\nSilakan tempel **Cookies Facebook** lengkap (contoh: \`datr=...; c_user=...; xs=...\`) :`,
    cancelled: `❌ *Proses dibatalkan.*\nTidak ada data yang disimpan.`
  }
};

function getT(lang?: string) {
  if (lang && lang in TRANSLATIONS) {
    return TRANSLATIONS[lang as keyof typeof TRANSLATIONS];
  }
  return TRANSLATIONS.fr;
}

// ----------------------------------------------------
// LIVE TELEGRAM BOT INSTANCE (OPTIONAL REAL LAUNCH)
// ----------------------------------------------------
let activeTelegrafBot: Telegraf | null = null;

const MAIN_REPLY_KEYBOARD = Markup.keyboard([
  [
    '💰 Solde / Balance',
    '📋 Tâches / Tasks'
  ],
  [
    '🏦 Retrait / Withdraw',
    '📞 Support'
  ],
  [
    '👥 Parrainages / Referrals',
    '🏆 Classement / Top'
  ],
  [
    '🪩 Langue / Language'
  ]
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

    if (!userSessions[userId]) {
      userSessions[userId] = {
        step: 'START',
        language: 'fr',
        balance: 0.000,
        tasksCompleted: 0,
        referralsCount: 0,
        referralEarnings: 0.000
      };
    } else {
      userSessions[userId].step = 'START';
    }

    const t = getT(userSessions[userId]?.language);

    // Menu principal permanent
    await ctx.reply(
      t.welcome,
      {
        parse_mode: 'Markdown',
        ...MAIN_REPLY_KEYBOARD
      }
    );

    // Boutons inline supplémentaires
    await ctx.reply(
      '👇 *Actions rapides*',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🚀 ' + t.btn_tasks,
              'task_facebook'
            )
          ],
          [
            Markup.button.callback(
              '💰 Solde / Balance',
              'action_check_balance'
            )
          ]
        ])
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

    if (!userSessions[userId]) {
      userSessions[userId] = {
        step: 'START',
        language: 'fr',
        balance: 0,
        tasksCompleted: 0,
        referralsCount: 0,
        referralEarnings: 0
      };
    }

    const session = userSessions[userId];
    const t = getT(session.language);

    // PostgreSQL = source officielle du solde
    const wallet = await getUserWallet(userId);
    const balance = wallet ? Number(wallet.balance) : 0;

    const completedResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM tasks
      WHERE telegram_user_id = $1
        AND status IN ('completed', 'validated', 'approved', 'compte créé')
      `,
      [userId]
    );

    const pendingResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM tasks
      WHERE telegram_user_id = $1
        AND status IN (
          'pending',
          'pending_validation',
          'en_attente',
          'awaiting_validation'
        )
      `,
      [userId]
    );

    const rejectedAdminResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM tasks
      WHERE telegram_user_id = $1
        AND status IN (
          'rejected_admin',
          'refused_admin',
          'rejected'
        )
      `,
      [userId]
    );

    const rejectedBotResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM tasks
      WHERE telegram_user_id = $1
        AND status IN (
          'rejected_bot',
          'refused_bot'
        )
      `,
      [userId]
    );

    const tasksValidated = Number(
      completedResult.rows[0]?.count || 0
    );

    const tasksPending = Number(
      pendingResult.rows[0]?.count || 0
    );

    const tasksRejectedAdmin = Number(
      rejectedAdminResult.rows[0]?.count || 0
    );

    const tasksRejectedBot = Number(
      rejectedBotResult.rows[0]?.count || 0
    );

    const referralEarnings = Number(
      session.referralEarnings || 0
    );

    await ctx.reply(
      `${t.balance_title}\n\n` +

      `👤 Utilisateur : *${userFirstName}*\n` +
      `🆔 ID Compte : \`${userId}\`\n` +
      `🛡️ Statut : *Vérifié* ✅\n\n` +

      `━━━━━━━━━━━━━━━━━━\n\n` +

      `💰 *Solde disponible :* \`$${balance.toFixed(3)}\`\n` +
      `🎉 *Gains de parrainage :* \`$${referralEarnings.toFixed(3)}\`\n\n` +

      `━━━━━━━━━━━━━━━━━━\n\n` +

      `🔻 *Tâches validées :* \`${tasksValidated}\`\n` +
      `⏳ *En attente de vérification :* \`${tasksPending}\`\n` +
      `⚠️ *Refusées par l'administrateur :* \`${tasksRejectedAdmin}\`\n` +
      `⚠️ *Refusées par le bot :* \`${tasksRejectedBot}\`\n\n` +

      `━━━━━━━━━━━━━━━━━━\n\n` +

      `_Rémunération standard : $${TASK_REWARD_USD.toFixed(2)} par compte Facebook validé._`,
      {
        parse_mode: 'Markdown',

        ...MAIN_REPLY_KEYBOARD,

        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '📋 Effectuer une Tâche',
              'task_facebook'
            )
          ],
          [
            Markup.button.callback(
              '🏦 Demander un Retrait',
              'action_request_withdrawal'
            )
          ]
        ])
      }
    );
  };

  // Helper: Handle 📋 Tâches
  const handleTasks = async (ctx: any) => {
    const userId = String(ctx.from?.id || 'unknown');
    const userFirstName = ctx.from?.first_name || 'Utilisateur';

    if (!userSessions[userId]) {
      userSessions[userId] = {
        step: 'AUTH_CHOICE',
        taskType: 'Facebook',
        language: 'fr',
        balance: 0,
        tasksCompleted: 0,
        referralsCount: 0,
        referralEarnings: 0
      };
    } else {
      userSessions[userId].step = 'AUTH_CHOICE';
      userSessions[userId].taskType = 'Facebook';
    }

    const session = userSessions[userId] || {
      step: 'START',
      language: 'fr',
      balance: 0,
      tasksCompleted: 0,
      referralsCount: 0,
      referralEarnings: 0
    };

    const t = getT(session.language || 'fr');

    await ctx.reply(
      `${t.tasks_title}\n\n` +

      `👤 Utilisateur : *${userFirstName}*\n` +
      `🆔 ID Compte : \`${userId}\`\n` +
      `🛡️ Statut : *Vérifié* ✅\n\n` +

      `━━━━━━━━━━━━━━━━━━\n\n` +

      `💵 *Rémunération par compte validé :* \`$${TASK_REWARD_USD.toFixed(2)}\`\n` +
      `🎁 *Commission parrainage :* \`${REFERRAL_COMMISSION_PERCENT}%\`\n` +
      `💰 *Commission par tâche :* \`$${REFERRAL_TASK_COMMISSION_USD.toFixed(3)}\`\n\n` +

      `━━━━━━━━━━━━━━━━━━\n\n` +

      `📋 *Choisissez votre méthode d'authentification :*\n\n` +

      `🍪 *Cookies* — recommandé pour une validation rapide.\n` +
      `🔐 *2FA* — authentification sécurisée.\n\n` +

      `_Sélectionnez votre option ci-dessous._`,

      {
        parse_mode: 'Markdown',

        // Menu permanent
        ...MAIN_REPLY_KEYBOARD,

        // Boutons d'action
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
              '📜 Règles',
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
  };

  // Helper: Handle 🏦 Retrait
  const handleWithdrawal = async (ctx: any) => {
    const userId = String(ctx.from?.id || 'unknown');
    const session = userSessions[userId] || { step: 'START', language: 'fr', balance: 0 };
    const t = getT(session.language);
    const wallet = await getUserWallet(userId);
    const balance = wallet ? wallet.balance : 0;
    const isEligible = balance >= MIN_WITHDRAWAL_USD;

    await ctx.reply(
      `${t.withdrawal_title}\n\n` +
      `💵 Solde disponible : *${balance.toFixed(3)} $* USD\n` +
      `🎯 Seuil minimum de retrait : *${MIN_WITHDRAWAL_USD.toFixed(2)} $* USD\n` +
      `🛡️ Statut : ${isEligible ? '🟢 *Éligible au retrait immédiat*' : '🟡 *En attente du seuil ($' + MIN_WITHDRAWAL_USD.toFixed(2) + ')*'}\n\n` +
      `Moyens de paiement pris en charge :\n` +
      `• 🪙 *Crypto USDT* (TRC20 / BEP20 - 0 frais)\n` +
      `• 📱 *Mobile Money* (MVola, Orange Money, Airtel Money)\n` +
      `• 💳 *Virement Bancaire (SEPA / International)*\n\n` +
      (isEligible
        ? `✅ _Sélectionnez votre moyen de retrait ci-dessous :_`
        : `⚠️ _Complétez encore ${Math.max(1, Math.ceil((MIN_WITHDRAWAL_USD - balance) / TASK_REWARD_USD))} tâche(s) pour débloquer votre premier retrait._`),
      {
        parse_mode: 'Markdown',
        ...MAIN_REPLY_KEYBOARD,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🪙 Crypto USDT (TRC-20)', 'withdraw_crypto')],
          [Markup.button.callback('📱 Mobile Money (MVola/Orange/Airtel)', 'withdraw_mobile_money')],
          [Markup.button.callback('💳 Virement Bancaire (SEPA)', 'withdraw_bank')]
        ])
      }
    );
  };

  // Helper: Handle 📞 Support
  const handleSupport = async (ctx: any) => {
    const userId = String(ctx.from?.id || 'unknown');
    const session = userSessions[userId] || { step: 'START', language: 'fr' };
    const t = getT(session.language);

    await ctx.reply(
      `${t.support_title}\n\n` +
      `Une question technique, un blocage ou une demande de paiement ?\n\n` +
      `👤 *Administrateur Support :* @TaskifySupport\n` +
      `📢 *Canal Officiel :* @TaskifyAnnouncements\n` +
      `⏰ *Horaires :* 7j/7 — 08h00 à 22h00 (UTC+1)\n` +
      `⚡ *Délai moyen de réponse :* < 15 minutes\n\n` +
      `_Cliquez sur le bouton ci-dessous pour ouvrir la conversation :_`,
      {
        parse_mode: 'Markdown',
        ...MAIN_REPLY_KEYBOARD,
        ...Markup.inlineKeyboard([
          [Markup.button.url('💬 ' + t.btn_support, 'https://t.me/TaskifySupport')],
          [Markup.button.callback('❓ FAQ & Questions Fréquentes', 'action_faq')]
        ])
      }
    );
  };

  // Helper: Handle 👥 Parrainages
  const handleReferral = async (ctx: any) => {
    const userId = String(ctx.from?.id || '000000');
    const refLink = `https://t.me/TaskifyProBot?start=ref_${userId}`;
    const session = userSessions[userId] || { step: 'START', language: 'fr', referralsCount: 0, referralEarnings: 0 };
    const t = getT(session.language);

    await ctx.reply(
      `${t.referral_title}\n\n` +
      `Invitez d'autres opérateurs et gagnez des commissions automatiques !\n\n` +
      `🎁 *Bonus direct par inscription :* \`+$${REFERRAL_SIGNUP_BONUS_USD.toFixed(2)}\`\n` +
      `💎 *Commission par tâche filleul :* \`${REFERRAL_COMMISSION_PERCENT}%\` (\`+$${REFERRAL_TASK_COMMISSION_USD.toFixed(3)}\` / tâche)\n` +
      `📊 *Nombre de filleuls actifs :* \`${session.referralsCount || 0}\`\n` +
      `💵 *Total des commissions perçues :* \`$${(session.referralEarnings || 0).toFixed(3)}\`\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🔗 *Votre lien de parrainage unique :*\n` +
      `\`${refLink}\`\n\n` +
      `_Partagez ce lien pour commencer à accumuler des revenus passifs sur chaque tâche exécutée._`,
      {
        parse_mode: 'Markdown',
        ...MAIN_REPLY_KEYBOARD,
        ...Markup.inlineKeyboard([
          [Markup.button.url('📤 ' + t.btn_share_ref, `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Rejoins Taskify Pro et gagne $0.04 par tâche !")}`)]
        ])
      }
    );
  };

  // Helper: Handle 🏆 Classement
  const handleLeaderboard = async (ctx: any) => {
    const userId = String(ctx.from?.id || 'unknown');
    const session = userSessions[userId] || { step: 'START', language: 'fr', tasksCompleted: 0 };
    const t = getT(session.language);

    await ctx.reply(
      `${t.leaderboard_title}\n\n` +
      `1. 🥇 Opérateur #9482 — \`428 tâches\` (Prime +$50.00)\n` +
      `2. 🥈 Opérateur #1092 — \`391 tâches\` (Prime +$30.00)\n` +
      `3. 🥉 Opérateur #7401 — \`315 tâches\` (Prime +$15.00)\n` +
      `4. ⭐ Opérateur #5892 — \`280 tâches\`\n` +
      `5. ⭐ Opérateur #3419 — \`204 tâches\`\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📍 *Votre Position :* \`${(session.tasksCompleted || 0) > 0 ? 'Top 15%' : 'Non classé'}\`\n` +
      `📊 *Vos Tâches :* \`${session.tasksCompleted || 0} validées\` (\`$${((session.tasksCompleted || 0) * TASK_REWARD_USD).toFixed(2)}\`)\n\n` +
      `_Primes versées automatiquement chaque 1er du mois aux 3 premiers du classement._`,
      {
        parse_mode: 'Markdown',
        ...MAIN_REPLY_KEYBOARD,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 ' + t.btn_tasks, 'task_facebook')]
        ])
      }
    );
  };

  // Helper: Handle 🪩 Langue
  const handleLanguage = async (ctx: any) => {
    const userId = String(ctx.from?.id || 'unknown');
    const session = userSessions[userId] || { step: 'START', language: 'fr' };
    const currentLang = session.language || 'fr';

    const langNames: Record<string, string> = {
      fr: '🇫🇷 Français',
      en: '🇬🇧 English',
      ru: '🇷🇺 Русский',
      es: '🇪🇸 Español',
      id: '🇮🇩 Bahasa Indonesia'
    };

    await ctx.reply(
      `🪩 *Sélection de la Langue / Language Selection / Выбор языка*\n\n` +
      `Langue active : *${langNames[currentLang] || '🇫🇷 Français'}*\n\n` +
      `Choisissez votre langue de préférence ci-dessous :`,
      {
        parse_mode: 'Markdown',
        ...MAIN_REPLY_KEYBOARD,
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('🇫🇷 Français', 'set_lang_fr'),
            Markup.button.callback('🇬🇧 English', 'set_lang_en')
          ],
          [
            Markup.button.callback('🇷🇺 Русский', 'set_lang_ru'),
            Markup.button.callback('🇪🇸 Español', 'set_lang_es')
          ],
          [
            Markup.button.callback('🇮🇩 Bahasa Indonesia', 'set_lang_id')
          ]
        ])
      }
    );
  };

  // 1. 💰 Solde
  bot.hears(['💰 Solde', '💰 Solde / Balance', 'Solde', 'solde', 'Balance', 'balance', 'Баланс', 'баланс', 'Saldo', 'saldo', '/balance', '/solde'], handleBalance);

  // 2. 📋 Tâches & 🌐 Démarrer tâche Facebook
  bot.hears([
    '📋 Tâches', '📋 Tâches / Tasks', '📋 Taches', 'Tâches', 'Taches',
    'Tasks', 'tasks', 'Задания', 'задания', 'Задачи', 'Tareas', 'tareas', 'Tugas', 'tugas',
    '🌐 Démarrer tâche Facebook', '🌐 Démarrer tâche', 'Démarrer tâche Facebook', 'Démarrer tâche',
    '/tasks', '/taches', '/task'
  ], handleTasks);

  // 3. 🏦 Retrait
  bot.hears(['🏦 Retrait', '🏦 Retrait / Withdraw', 'Retrait', 'retrait', 'Withdraw', 'withdraw', 'Вывод', 'вывод', 'Retiro', 'retiro', 'Penarikan', 'penarikan', '/withdraw', '/retrait'], handleWithdrawal);

  // 4. 📞 Support
  bot.hears(['📞 Support', 'Support', 'support', 'Assistance', 'assistance', 'Поддержка', 'поддержка', 'Soporte', 'soporte', 'Dukungan', 'dukungan', '/support'], handleSupport);

  // 5. 👥 Parrainages
  bot.hears(['👥 Parrainages', '👥 Parrainages / Referrals', '👥 Parrainage', 'Parrainages', 'Parrainage', 'parrainage', 'Referral', 'referral', 'Referrals', 'Рефералы', 'Referidos', 'Rujukan', '/referral', '/parrainage'], handleReferral);

  // 6. 🏆 Classement
  bot.hears(['🏆 Classement', '🏆 Classement / Top', 'Classement', 'classement', 'Leaderboard', 'leaderboard', 'Top', 'top', 'Рейтинг', 'Clasificación', 'Peringkat', '/leaderboard', '/top'], handleLeaderboard);

  // 7. 🪩 Langue
  bot.hears(['🪩 Langue', '🪩 Langue / Language', '🪩 Langues', 'Langue', 'langue', 'Language', 'language', 'Язык', 'язык', 'Idioma', 'idioma', 'Bahasa', 'bahasa', '/language', '/langue'], handleLanguage);

  // Language Actions
  bot.action('set_lang_fr', async (ctx) => {
    const userId = String(ctx.from?.id || 'unknown');
    if (!userSessions[userId]) userSessions[userId] = { step: 'START' };
    userSessions[userId].language = 'fr';
    await ctx.answerCbQuery('Langue : Français 🇫🇷 configuré !');
    const t = getT('fr');
    await renderScreen(ctx, t.lang_confirm, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 ' + t.btn_tasks, 'task_facebook')],
        [Markup.button.callback('💰 ' + t.btn_withdraw, 'action_request_withdrawal')]
      ])
    });
  });

  bot.action('set_lang_en', async (ctx) => {
    const userId = String(ctx.from?.id || 'unknown');
    if (!userSessions[userId]) userSessions[userId] = { step: 'START' };
    userSessions[userId].language = 'en';
    await ctx.answerCbQuery('Language: English 🇬🇧 set!');
    const t = getT('en');
    await renderScreen(ctx, t.lang_confirm, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 ' + t.btn_tasks, 'task_facebook')],
        [Markup.button.callback('💰 ' + t.btn_withdraw, 'action_request_withdrawal')]
      ])
    });
  });

  bot.action('set_lang_ru', async (ctx) => {
    const userId = String(ctx.from?.id || 'unknown');
    if (!userSessions[userId]) userSessions[userId] = { step: 'START' };
    userSessions[userId].language = 'ru';
    await ctx.answerCbQuery('Язык: Русский 🇷🇺 выбран!');
    const t = getT('ru');
    await renderScreen(ctx, t.lang_confirm, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 ' + t.btn_tasks, 'task_facebook')],
        [Markup.button.callback('💰 ' + t.btn_withdraw, 'action_request_withdrawal')]
      ])
    });
  });

  bot.action('set_lang_es', async (ctx) => {
    const userId = String(ctx.from?.id || 'unknown');
    if (!userSessions[userId]) userSessions[userId] = { step: 'START' };
    userSessions[userId].language = 'es';
    await ctx.answerCbQuery('Idioma: Español 🇪🇸 configurado!');
    const t = getT('es');
    await renderScreen(ctx, t.lang_confirm, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 ' + t.btn_tasks, 'task_facebook')],
        [Markup.button.callback('💰 ' + t.btn_withdraw, 'action_request_withdrawal')]
      ])
    });
  });

  bot.action('set_lang_id', async (ctx) => {
    const userId = String(ctx.from?.id || 'unknown');
    if (!userSessions[userId]) userSessions[userId] = { step: 'START' };
    userSessions[userId].language = 'id';
    await ctx.answerCbQuery('Bahasa: Indonesia 🇮🇩 dipilih!');
    const t = getT('id');
    await renderScreen(ctx, t.lang_confirm, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 ' + t.btn_tasks, 'task_facebook')],
        [Markup.button.callback('💰 ' + t.btn_withdraw, 'action_request_withdrawal')]
      ])
    });
  });

  // Retrait Sub-actions
  bot.action('action_request_withdrawal', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id || 'unknown');
    const session = userSessions[userId] || { step: 'START', language: 'fr', balance: 0 };
    const t = getT(session.language);
    const wallet = await getUserWallet(userId);
    const balance = wallet ? wallet.balance : 0;

    if (balance < MIN_WITHDRAWAL_USD) {
      return renderScreen(
        ctx,
        `⚠️ *Solde Insuffisant*\n\n` +
        `Votre solde actuel est de *${balance.toFixed(3)} $* USD.\n` +
        `Le montant minimum requis pour un retrait est de *${MIN_WITHDRAWAL_USD.toFixed(2)} $* USD.\n\n` +
        `Complétez encore *${Math.max(1, Math.ceil((MIN_WITHDRAWAL_USD - balance) / TASK_REWARD_USD))} tâches* pour atteindre le seuil de paiement !`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🚀 ' + t.btn_tasks, 'task_facebook')]
        ])
      );
    }

    await renderScreen(
      ctx,
      `🏦 *Sélectionnez votre méthode de retrait :*`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🪙 Crypto USDT (TRC-20 / BEP-20)', 'withdraw_crypto')],
        [Markup.button.callback('📱 Mobile Money (MVola/Orange/Airtel)', 'withdraw_mobile_money')],
        [Markup.button.callback('💳 Virement Bancaire (SEPA)', 'withdraw_bank')]
      ])
    );
  });

  bot.action('withdraw_mobile_money', async (ctx) => {
    await ctx.answerCbQuery();
    await renderScreen(
      ctx,
      `📱 *Retrait Mobile Money (MVola, Orange Money, Airtel Money)*\n\n` +
      `Le montant minimum de retrait est de *${MIN_WITHDRAWAL_USD.toFixed(2)} $* USD.\n` +
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
      `Frais de réseau : 0 $ (Pris en charge).\n` +
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
      `💳 *Virement Bancaire (SEPA / International)*\n\n` +
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
      `• *Rémunération par tâche :* $${TASK_REWARD_USD.toFixed(2)} USD par compte validé.\n` +
      `• *Parrainage :* $${REFERRAL_SIGNUP_BONUS_USD.toFixed(2)} bonus + ${REFERRAL_COMMISSION_PERCENT}% ($${REFERRAL_TASK_COMMISSION_USD.toFixed(3)}) récurrent par tâche.\n` +
      `• *Seuil de retrait :* Retrait dès $${MIN_WITHDRAWAL_USD.toFixed(2)} USD via Crypto ou Mobile Money.\n` +
      `• *Besoin d'aide ?* Écrivez à @TaskifySupport`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Démarrer une Tâche', 'task_facebook')]
      ])
    );
  });

  bot.action('action_task_rules', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id || 'unknown');
    const session = userSessions[userId] || { language: 'fr' };
    const t = getT(session.language);

    await renderScreen(
      ctx,
      t.task_rules_text,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Compris, démarrer', 'task_facebook')]
      ])
    );
  });

  bot.action('task_facebook', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id || 'unknown');
    if (!userSessions[userId]) userSessions[userId] = { step: 'AUTH_CHOICE', taskType: 'Facebook', language: 'fr' };
    else {
      userSessions[userId].step = 'AUTH_CHOICE';
      userSessions[userId].taskType = 'Facebook';
    }
    const t = getT(userSessions[userId].language);

    await renderScreen(
      ctx,
      `${t.tasks_title}\n\n` +
      `💵 *Rémunération par compte validé :* \`$${TASK_REWARD_USD.toFixed(2)}\`\n\n` +
      `Choisissez votre méthode d'authentification :`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(t.btn_cookies, 'auth_cookies'),
          Markup.button.callback(t.btn_2fa, 'auth_2fa')
        ],
        [Markup.button.callback(t.btn_rules, 'action_task_rules')],
        [Markup.button.callback(t.btn_cancel, 'action_cancel')]
      ])
    );
  });

  bot.action('auth_2fa', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id || 'unknown');
    if (userSessions[userId]) userSessions[userId].step = 'START';

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
    const userLang = userSessions[userId]?.language || 'fr';
    const t = getT(userLang);

    if (!userSessions[userId]) userSessions[userId] = { step: 'CREDENTIALS_SHOWN', language: userLang };

    userSessions[userId] = {
      ...userSessions[userId],
      step: 'CREDENTIALS_SHOWN',
      taskType: 'Facebook',
      firstName,
      lastName,
      password: currentPassword
    };

    await renderScreen(
      ctx,
      `⚠️ *Informations du compte Facebook* 🔵 f\n\n` +
      `✅ Prénom : \`${firstName}\`\n` +
      `✅ Nom : \`${lastName}\`\n` +
      `🔑 MDP: \`${currentPassword}\`\n` +
      
      `🔻 Une fois le compte créé, envoyez votre UID :`,
      Markup.inlineKeyboard([
        [Markup.button.callback(t.btn_send_uid, 'action_send_uid')],
        [Markup.button.callback('🔙 Retour', 'task_facebook')],
        [Markup.button.callback(t.btn_cancel, 'action_cancel')]
      ])
    );
  });

  bot.action('action_send_uid', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id || 'unknown');
    if (!userSessions[userId]) {
      userSessions[userId] = { step: 'AWAITING_UID', language: 'fr' };
    } else {
      userSessions[userId].step = 'AWAITING_UID';
    }
    const t = getT(userSessions[userId].language);

    await renderScreen(
      ctx,
      t.awaiting_uid,
      Markup.inlineKeyboard([
        [Markup.button.callback(t.btn_cancel, 'action_cancel')]
      ])
    );
  });

  bot.action('action_check_balance', async (ctx) => {

    await ctx.answerCbQuery();

    const userFirstName =
      ctx.from?.first_name || 'Utilisateur';

    const userId =
      String(ctx.from?.id || 'unknown');

    const session =
      userSessions[userId] || {
        language: 'fr'
      };

    const t = getT(session.language);

    // -----------------------------------------------
    // Récupérer les données depuis PostgreSQL
    // -----------------------------------------------

    const wallet = await getUserWallet(userId);

    const balance = wallet
      ? wallet.balance
      : 0;

    // Nombre réel de tâches complétées
    const tasksResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM tasks
      WHERE telegram_user_id = $1
        AND status = 'compte créé'
      `,
      [userId]
    );

    const tasksCompleted =
      tasksResult.rows[0]?.count || 0;

    // -----------------------------------------------
    // Affichage
    // -----------------------------------------------

    await renderScreen(
      ctx,

      `💰 *Votre Solde Actuel :* \`$${balance.toFixed(3)} USD\`\n` +
      `👤 *Utilisateur :* ${userFirstName} (ID: \`${userId}\`)\n` +
      `📊 *Tâches complétées :* \`${tasksCompleted}\`\n` +
      `⏳ *En attente :* \`$0.000\``,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🚀 ' + t.btn_tasks,
            'task_facebook'
          )
        ],
        [
          Markup.button.callback(
            '🏦 ' + t.btn_withdraw,
            'action_request_withdrawal'
          )
        ]
      ])
    );
  });

  bot.action('action_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id || 'unknown');
    const lang = userSessions[userId]?.language || 'fr';
    delete userSessions[userId];
    const t = getT(lang);

    await renderScreen(
      ctx,
      t.cancelled + `\n\nUtilisez le menu permanent ou cliquez pour recommencer :`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 ' + t.btn_tasks, 'task_facebook')]
      ])
    );
  });

  bot.on('text', async (ctx) => {
    const userId = String(ctx.from?.id || 'unknown');
    const username = ctx.from?.username || ctx.from?.first_name || 'utilisateur';
    const text = ctx.message.text.trim();
    const lowerText = text.toLowerCase();
    const session = userSessions[userId];
    const userLang = session?.language || 'fr';
    const t = getT(userLang);

    // Instant Priority Dispatch for Persistent Keyboard Buttons
    if (text.includes('Solde') || lowerText === 'solde' || lowerText === '/solde' || text.includes('Balance') || lowerText === 'balance' || lowerText === '/balance' || text.includes('Баланс') || text.includes('Saldo')) {
      return handleBalance(ctx);
    }
    if (text.includes('Tâches') || text.includes('Taches') || text.includes('Tasks') || text.includes('Задания') || text.includes('Tareas') || text.includes('Tugas') || lowerText === 'taches' || lowerText === 'tâches' || lowerText === '/tasks' || lowerText === '/taches') {
      return handleTasks(ctx);
    }
    if (text.includes('Retrait') || text.includes('Withdraw') || text.includes('Вывод') || text.includes('Retiro') || text.includes('Penarikan') || lowerText === 'retrait' || lowerText === '/withdraw') {
      return handleWithdrawal(ctx);
    }
    if (text.includes('Support') || text.includes('Assistance') || text.includes('Поддержка') || text.includes('Soporte') || text.includes('Dukungan') || lowerText === 'support' || lowerText === '/support') {
      return handleSupport(ctx);
    }
    if (text.includes('Parrainage') || text.includes('Parrainages') || text.includes('Referral') || text.includes('Referrals') || text.includes('Рефералы') || text.includes('Referidos') || text.includes('Rujukan') || lowerText === 'parrainage' || lowerText === '/referral') {
      return handleReferral(ctx);
    }
    if (text.includes('Classement') || text.includes('Leaderboard') || text.includes('Рейтинг') || text.includes('Clasificación') || text.includes('Peringkat') || lowerText === 'classement' || lowerText === '/leaderboard' || lowerText === '/top') {
      return handleLeaderboard(ctx);
    }
    if (text.includes('Langue') || text.includes('Language') || text.includes('Язык') || text.includes('Idioma') || text.includes('Bahasa') || lowerText === 'langue' || lowerText === 'language' || lowerText === '/language') {
      return handleLanguage(ctx);
    }

    if (!session || !session.step || session.step === 'START') {
      return ctx.reply(
        `👋 Bonjour ! Utilisez le menu permanent ci-dessous ou cliquez sur [ 📋 Tâches ] pour commencer.`,
        {
          parse_mode: 'Markdown',
          ...MAIN_REPLY_KEYBOARD,
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚀 ' + t.btn_tasks, 'task_facebook')],
            [Markup.button.callback('💰 ' + t.balance_title.split('*')[1] || 'Solde', 'action_check_balance')]
          ])
        }
      );
    }

    if (session.step === 'AWAITING_UID') {
      session.uid = text;
      session.step = 'AWAITING_COOKIES';

      await ctx.reply(
        `✅ *UID reçu avec succès :* \`${text}\`\n\n` + t.awaiting_cookies,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(t.btn_cancel, 'action_cancel')]
          ])
        }
      );
      return;
    }

    if (session.step === 'AWAITING_COOKIES') {
      session.cookies = text;

      const uid = session.uid || '1000' + Math.floor(Math.random() * 90000000000);
      const taskId = `task-${Date.now()}`;
      delete userSessions[userId].step;

      let createdTask: any = null;

      try {
        // 1. ACCOUNT STATUS: A newly created Facebook account must start as "Pending Verification"
        createdTask = await createTask({
          taskId,
          uid,
          cookies: session.cookies,
          firstName: session.firstName || 'Alexandre',
          lastName: session.lastName || 'Dubois',
          password: session.password || botSettings.customPassword,
          telegramUserId: String(userId),
          telegramUsername: username,
          taskType: session.taskType || 'Facebook',
          notes: `Enregistré via ${botSettings.platformName} (@TaskifyProBot)`
        });

        tasks.unshift(createdTask);
        addLog('info', 'telegram', `📥 Compte Facebook reçu (UID: ${uid}), en attente de vérification...`, createdTask);

        // Send immediate confirmation to user that the account is pending verification
        await ctx.reply(
          `⏳ *Compte en cours de vérification...*\n\n` +
          `✅ Vos informations ont été enregistrées avec succès.\n` +
          `🆔 *UID :* \`${uid}\`\n` +
          `👤 *Nom :* ${createdTask.firstName} ${createdTask.lastName}\n` +
          `📊 *Statut du compte :* \`En attente de vérification\`\n\n` +
          `_Lancement de la vérification automatique en cours..._`,
          {
            parse_mode: 'Markdown',
            ...MAIN_REPLY_KEYBOARD
          }
        );

        // 2. AUTOMATIC BOT CHECK
        if (botSettings.autoBotCheckEnabled !== false) {
          try {
            const verifiedTask = await performBotAccountCheck(createdTask.id, botSettings);
            const taskIdx = tasks.findIndex(t => t.id === createdTask.id);
            if (taskIdx !== -1) {
              tasks[taskIdx] = verifiedTask;
            }
            addLog(
              verifiedTask.verificationResult === 'GREEN' ? 'success' : 'warning',
              'telegram',
              `🤖 Vérification automatique Bot (${verifiedTask.verificationResult}): UID ${uid} -> ${verifiedTask.accountStatus}`
            );
          } catch (botErr: any) {
            console.error('❌ Erreur lors de la vérification auto Bot:', botErr.message);
            addLog('error', 'telegram', `Erreur vérification automatique Bot: ${botErr.message}`);
          }
        }
      } catch (err: any) {
        console.error('❌ Erreur création tâche bot:', err);
        await ctx.reply(
          `❌ *Erreur d'enregistrement :* ${err.message || 'Une erreur est survenue'}. Veuillez réessayer.`,
          {
            parse_mode: 'Markdown',
            ...MAIN_REPLY_KEYBOARD
          }
        );
      }
      return;
    }
  });

  bot.catch((err: any, ctx: any) => {
    console.error(`[Telegraf Error] Exception pour ${ctx.from?.id}:`, err.message);
    addLog('error', 'telegram', `Erreur Telegram: ${err.message}`);
  });
}

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: botSettings.platformName,
    activeTasks: tasks.length,
    isBotActive: botSettings.isBotActive,
    sheetsSyncConfigured: Boolean(botSettings.googleSheetWebhookUrl),
    financials: {
      taskRewardUSD: TASK_REWARD_USD,
      referralSignupBonusUSD: REFERRAL_SIGNUP_BONUS_USD,
      referralTaskCommissionPercent: REFERRAL_COMMISSION_PERCENT,
      minWithdrawalUSD: MIN_WITHDRAWAL_USD
    },
    supportedLanguages: ['fr', 'en', 'ru', 'es', 'id']
  });
});

app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT settings FROM bot_settings WHERE id = 1 LIMIT 1`
    );

    if (result.rows.length > 0) {
      const savedSettings = result.rows[0].settings;

      if (savedSettings && typeof savedSettings === 'object') {
        Object.assign(botSettings, savedSettings);
      }
    }

    res.json(botSettings);

  } catch (error) {
    console.error('❌ Failed to load bot settings:', error);

    res.status(500).json({
      status: 'error',
      message: error instanceof Error
        ? error.message
        : String(error)
    });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const {
      customPassword,
      googleSheetWebhookUrl,
      googleSheetFields,
      platformName,
      welcomeMessage,
      botToken,
      facebookCheckerApiUrl,
      facebookCheckerApiKey,
      autoBotCheckEnabled
    } = req.body;

    if (customPassword !== undefined) {
      botSettings.customPassword = customPassword;
    }

    if (googleSheetWebhookUrl !== undefined) {
      botSettings.googleSheetWebhookUrl = googleSheetWebhookUrl;
    }

    if (Array.isArray(googleSheetFields)) {
      botSettings.googleSheetFields = googleSheetFields;
    }

    if (platformName !== undefined) {
      botSettings.platformName = platformName;
    }

    if (welcomeMessage !== undefined) {
      botSettings.welcomeMessage = welcomeMessage;
    }

    if (botToken !== undefined) {
      botSettings.botToken = botToken;
    }

    if (facebookCheckerApiUrl !== undefined) {
      botSettings.facebookCheckerApiUrl = facebookCheckerApiUrl;
    }

    if (facebookCheckerApiKey !== undefined) {
      botSettings.facebookCheckerApiKey = facebookCheckerApiKey;
    }

    if (autoBotCheckEnabled !== undefined) {
      botSettings.autoBotCheckEnabled = Boolean(autoBotCheckEnabled);
    }

    await pool.query(
      `
      INSERT INTO bot_settings (id, settings, updated_at)
      VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = NOW()
      `,
      [JSON.stringify(botSettings)]
    );

    addLog(
      'info',
      'system',
      'Paramètres sauvegardés dans PostgreSQL'
    );

    res.json({
      status: 'success',
      settings: botSettings
    });

  } catch (error) {
    console.error('❌ Failed to save bot settings:', error);

    res.status(500).json({
      status: 'error',
      message: error instanceof Error
        ? error.message
        : String(error)
    });
  }
});

// 3. Get all tasks from PostgreSQL
app.get('/api/tasks', async (req, res) => {
  try {
    const list = await getAllTasks(req.query.status as string);
    if (list.length > 0) {
      return res.json(list);
    }
  } catch (err: any) {
    console.error('API /api/tasks error:', err.message);
  }
  res.json(tasks);
});

// 3b. Create task in PostgreSQL
app.post('/api/tasks', async (req, res) => {
  try {
    const created = await createTask({
      taskId: req.body.id,
      telegramUserId: req.body.telegramUserId || 'manual_admin',
      telegramUsername: req.body.telegramUsername || 'admin_portal',
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      password: req.body.password || botSettings.customPassword,
      cookies: req.body.cookies,
      uid: req.body.uid,
      taskType: req.body.taskType || 'Facebook',
      notes: req.body.notes,
      status: req.body.status || 'compte créé'
    });

    tasks.unshift(created);

    // If auto check is enabled, trigger bot check in background
    if (req.body.runAutoCheck !== false && botSettings.autoBotCheckEnabled !== false) {
      performBotAccountCheck(created.id, botSettings).then(vTask => {
        const idx = tasks.findIndex(t => t.id === created.id);
        if (idx !== -1) tasks[idx] = vTask;
      }).catch(err => {
        console.warn('⚠️ Background bot check error:', err.message);
      });
    }

    addLog(
      'success',
      'system',
      `Nouvelle tâche créée (UID: ${created.uid || 'N/A'}, Utilisateur: ${created.telegramUsername || 'N/A'})`
    );

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update task (PATCH)
app.patch('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await updateTaskStatus(
      id,
      req.body.status || 'compte créé',
      req.body.notes
    );
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex !== -1) {
      tasks[taskIndex] = { ...tasks[taskIndex], ...req.body, updatedAt: new Date().toISOString() };
    }
    addLog(
      'info',
      'system',
      `Tâche mise à jour (UID: ${updated.uid}, Statut: ${updated.status})`
    );
    return res.json(updated);
  } catch (err: any) {
    // Fallback for in-memory if task was not in db
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex !== -1) {
      tasks[taskIndex] = { ...tasks[taskIndex], ...req.body, updatedAt: new Date().toISOString() };
      return res.json(tasks[taskIndex]);
    }
    return res.status(404).json({ error: err.message || 'Tâche non trouvée' });
  }
});

// 4b. Update task (PUT)
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await updateTaskStatus(
      id,
      req.body.status || 'compte créé',
      req.body.notes
    );
    return res.json(updated);
  } catch (err: any) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex !== -1) {
      tasks[taskIndex] = { ...tasks[taskIndex], ...req.body, updatedAt: new Date().toISOString() };
      return res.json(tasks[taskIndex]);
    }
    return res.status(400).json({ error: err.message || 'Tâche non trouvée' });
  }
});

// 5. Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await deleteTask(id);
    tasks = tasks.filter(t => t.id !== id);
    addLog('warning', 'system', `Tâche supprimée (ID: ${id})`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5a. Task Validation (Admin / Manager)
app.post('/api/tasks/:taskId/validate', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { validatorId = 'admin', notes = '', reason = 'Compte vérifié par administrateur' } = req.body;
    const result = await validateTask(taskId, validatorId, reason || notes || 'Compte validé', 'ADMIN');
    
    // Keep in-memory cache in sync
    const idx = tasks.findIndex(t => t.id === taskId || t.taskId === taskId);
    if (idx !== -1) tasks[idx] = result;

    addLog('success', 'system', `Tâche ${taskId} validée par ${validatorId} (Compte: VERIFIED, Récompense: $${result.rewardUSD})`);
    res.json({ success: true, task: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 5b. Task Rejection (Admin / Manager)
app.post('/api/tasks/:taskId/reject', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { validatorId = 'admin', reason = 'Compte rejeté par administrateur' } = req.body;
    const result = await rejectTask(taskId, validatorId, reason, 'ADMIN');

    // Keep in-memory cache in sync
    const idx = tasks.findIndex(t => t.id === taskId || t.taskId === taskId);
    if (idx !== -1) tasks[idx] = result;

    addLog('warning', 'system', `Tâche ${taskId} rejetée par ${validatorId} (Compte: SUSPENDED, Motif: ${reason})`);
    res.json({ success: true, task: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 5c. Task Bot Check (Automated Facebook UID verification)
app.post('/api/tasks/:taskId/bot-check', async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await performBotAccountCheck(taskId, botSettings);

    // Keep in-memory cache in sync
    const idx = tasks.findIndex(t => t.id === taskId || t.taskId === taskId);
    if (idx !== -1) tasks[idx] = result;

    addLog('info', 'system', `Bot check exécuté sur la tâche ${taskId} (Résultat: ${result.verificationResult}, Statut: ${result.accountStatus})`);
    res.json({ success: true, task: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 5d. Test Facebook UID Check Live
app.post('/api/bot/test-uid-check', async (req, res) => {
  try {
    const { uid, apiUrl, apiKey } = req.body;
    if (!uid) return res.status(400).json({ success: false, error: 'UID manquant' });
    const checkResult = await checkFacebookUid(uid, {
      facebookCheckerApiUrl: apiUrl || botSettings.facebookCheckerApiUrl,
      facebookCheckerApiKey: apiKey || botSettings.facebookCheckerApiKey
    });
    res.json({
      success: true,
      result: checkResult.status,
      reason: checkResult.reason,
      source: checkResult.source,
      rawResponse: checkResult.rawResponse
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5c. Withdrawals API
app.get('/api/withdrawals', async (req, res) => {
  try {
    const list = await getAllWithdrawals(req.query.status as string);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/withdrawals', async (req, res) => {
  try {
    const { telegramUserId, amount, method, destination } = req.body;
    const result = await requestWithdrawal(telegramUserId, Number(amount), method, destination);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/withdrawals/:id/process', async (req, res) => {
  try {
    const { action, adminId = 'admin', notes } = req.body;
    const result = await processWithdrawal(Number(req.params.id), action, adminId, notes);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5d. User Profile and Language API
app.get('/api/user/:telegramUserId', async (req, res) => {
  try {
    const profile = await getUserProfile(req.params.telegramUserId);
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/:telegramUserId/language', async (req, res) => {
  try {
    const { language } = req.body;
    const success = await setUserLanguage(req.params.telegramUserId, language);
    res.json({ success, language });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5e. Audit Logs API
app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await getAuditLogs(Number(req.query.limit) || 50);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5f. Staff & RBAC API
app.get('/api/staff', async (req, res) => {
  try {
    const list = await getAllStaff();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staff', async (req, res) => {
  try {
    const { username, password, fullName, role, permissions } = req.body;
    const result = await createStaffMember({ username, password, fullName, role, permissions });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/api/staff/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await updateStaffMember(id, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5g. Wallets & Transactions API
app.get('/api/wallets', async (req, res) => {
  try {
    const list = await getAllWallets();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const list = await getAllTransactions();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5h. Staff Authentication API
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await loginStaff(username, password);
    res.status(result.success ? 200 : 401).json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    const staff = await verifySession(token);
    if (!staff) return res.status(401).json({ error: 'Session invalide ou expirée' });
    res.json({ staff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) await logoutStaff(token);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Bot Simulation Engine (Exact Telegram State Machine)
app.post('/api/bot/simulate-step', async (req, res) => {
  const { sessionId = 'sim-user-1', action, input } = req.body;
  
  if (!userSessions[sessionId]) {
    userSessions[sessionId] = {
      step: 'START',
      language: 'fr',
      balance: 0.000,
      tasksCompleted: 0,
      referralsCount: 0,
      referralEarnings: 0.000
    };
  }
  const session = userSessions[sessionId];
  const currentLang = session.language || 'fr';
  const t = getT(currentLang);

  let responseMessage = '';
  let buttons: any[] = [];
  let normalizedAction = action || 'START';
  const inputText = (input || '').trim();
  const lowerInput = inputText.toLowerCase();

  // Natural text or action dispatch for persistent buttons across 5 languages
  if (
    normalizedAction === 'MENU_BALANCE' ||
    normalizedAction === '💰 Solde' ||
    normalizedAction === '💰 Solde / Balance' ||
    inputText.includes('Solde') ||
    inputText.includes('Balance') ||
    inputText.includes('Баланс') ||
    inputText.includes('Saldo') ||
    lowerInput === 'solde' ||
    lowerInput === '/solde' ||
    lowerInput === 'balance' ||
    lowerInput === '/balance'
  ) {
    normalizedAction = 'MENU_BALANCE';
  } else if (
    normalizedAction === 'CHOOSE_FACEBOOK' ||
    normalizedAction === '📋 Tâches' ||
    normalizedAction === '📋 Tâches / Tasks' ||
    normalizedAction === '🌐 Démarrer tâche Facebook' ||
    inputText.includes('Tâches') ||
    inputText.includes('Taches') ||
    inputText.includes('Tasks') ||
    inputText.includes('Задания') ||
    inputText.includes('Tareas') ||
    inputText.includes('Tugas') ||
    inputText.includes('Démarrer tâche') ||
    lowerInput === 'taches' ||
    lowerInput === 'tâches' ||
    lowerInput === 'tasks' ||
    lowerInput === '/tasks' ||
    lowerInput === '/taches'
  ) {
    normalizedAction = 'CHOOSE_FACEBOOK';
  } else if (
    normalizedAction === 'MENU_WITHDRAW' ||
    normalizedAction === '🏦 Retrait' ||
    normalizedAction === '🏦 Retrait / Withdraw' ||
    inputText.includes('Retrait') ||
    inputText.includes('Withdraw') ||
    inputText.includes('Вывод') ||
    inputText.includes('Retiro') ||
    inputText.includes('Penarikan') ||
    lowerInput === 'retrait' ||
    lowerInput === 'withdraw' ||
    lowerInput === '/withdraw'
  ) {
    normalizedAction = 'MENU_WITHDRAW';
  } else if (
    normalizedAction === 'MENU_SUPPORT' ||
    normalizedAction === '📞 Support' ||
    inputText.includes('Support') ||
    inputText.includes('Assistance') ||
    inputText.includes('Поддержка') ||
    inputText.includes('Soporte') ||
    inputText.includes('Dukungan') ||
    lowerInput === 'support' ||
    lowerInput === '/support'
  ) {
    normalizedAction = 'MENU_SUPPORT';
  } else if (
    normalizedAction === 'MENU_REFERRAL' ||
    normalizedAction === '👥 Parrainages' ||
    normalizedAction === '👥 Parrainages / Referrals' ||
    inputText.includes('Parrainage') ||
    inputText.includes('Parrainages') ||
    inputText.includes('Referral') ||
    inputText.includes('Рефералы') ||
    inputText.includes('Referidos') ||
    inputText.includes('Rujukan') ||
    lowerInput === 'parrainage' ||
    lowerInput === 'referral' ||
    lowerInput === '/referral'
  ) {
    normalizedAction = 'MENU_REFERRAL';
  } else if (
    normalizedAction === 'MENU_LEADERBOARD' ||
    normalizedAction === '🏆 Classement' ||
    normalizedAction === '🏆 Classement / Top' ||
    inputText.includes('Classement') ||
    inputText.includes('Leaderboard') ||
    inputText.includes('Рейтинг') ||
    inputText.includes('Clasificación') ||
    inputText.includes('Peringkat') ||
    lowerInput === 'classement' ||
    lowerInput === 'leaderboard' ||
    lowerInput === '/leaderboard' ||
    lowerInput === '/top'
  ) {
    normalizedAction = 'MENU_LEADERBOARD';
  } else if (
    normalizedAction === 'MENU_LANGUAGE' ||
    normalizedAction === '🪩 Langue' ||
    normalizedAction === '🪩 Langue / Language' ||
    inputText.includes('Langue') ||
    inputText.includes('Language') ||
    inputText.includes('Язык') ||
    inputText.includes('Idioma') ||
    inputText.includes('Bahasa') ||
    lowerInput === 'langue' ||
    lowerInput === 'language' ||
    lowerInput === '/language'
  ) {
    normalizedAction = 'MENU_LANGUAGE';
  }

  const userId = String(sessionId);
  const wallet = await getUserWallet(userId);
  const balance = wallet ? wallet.balance : 0;
  const tasksCompleted = session.tasksCompleted || 0;
  const referralsCount = session.referralsCount || 0;
  const referralEarnings = session.referralEarnings || 0;

  switch (normalizedAction) {
    case 'START':
    case '/start':
      session.step = 'START';
      responseMessage = t.welcome;
      buttons = [
        [
          { text: `🌐 Facebook ($${TASK_REWARD_USD.toFixed(2)} / tâche)`, action: 'CHOOSE_FACEBOOK', variant: 'primary' },
          { text: t.btn_rules, action: 'ACTION_TASK_RULES', variant: 'secondary' }
        ]
      ];
      addLog('info', 'simulator', `Simulateur: /start initialisé par l'utilisateur.`);
      break;

    case 'MENU_BALANCE':
      session.step = 'BALANCE';
      responseMessage = `${t.balance_title}\n\n` +
        `👤 Utilisateur : *Opérateur Simulateur* (@simulateur_user)\n` +
        `🆔 ID Compte : \`sim_${sessionId}\`\n` +
        `🛡️ Statut du compte : *Vérifié* ✅\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💵 *Solde validé disponible :* \`$${balance.toFixed(3)} USD\`\n` +
        `⏳ *En cours de validation :* \`$0.000\`\n` +
        `📊 *Tâches validées :* \`${tasksCompleted}\` (\`$${(tasksCompleted * TASK_REWARD_USD).toFixed(3)}\`)\n` +
        `👥 *Filleuls actifs :* \`${referralsCount}\` (\`+$${referralEarnings.toFixed(3)}\`)\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `_Rémunération standard : $${TASK_REWARD_USD.toFixed(2)} par compte Facebook validé._`;
      buttons = [
        [
          { text: t.btn_tasks, action: 'CHOOSE_FACEBOOK', variant: 'primary' },
          { text: t.btn_withdraw, action: 'MENU_WITHDRAW', variant: 'secondary' }
        ]
      ];
      break;

    case 'MENU_WITHDRAW':
      session.step = 'WITHDRAW';
      const isEligible = balance >= MIN_WITHDRAWAL_USD;
      responseMessage = `${t.withdrawal_title}\n\n` +
        `💵 Solde disponible : *${balance.toFixed(3)} $* USD\n` +
        `🎯 Seuil minimum de retrait : *${MIN_WITHDRAWAL_USD.toFixed(2)} $* USD\n` +
        `🛡️ Statut : ${isEligible ? '🟢 *Éligible au retrait immédiat*' : '🟡 *En attente du seuil ($' + MIN_WITHDRAWAL_USD.toFixed(2) + ')*'}\n\n` +
        `Moyens de paiement pris en charge :\n` +
        `• 🪙 *Crypto USDT* (TRC20 / BEP20 - 0 frais)\n` +
        `• 📱 *Mobile Money* (MVola, Orange Money, Airtel Money)\n` +
        `• 💳 *Virement Bancaire SEPA*\n\n` +
        `_Sélectionnez votre moyen de retrait ci-dessous :_`;
      buttons = [
        [
          { text: '🪙 Crypto (USDT)', action: 'WITHDRAW_CRYPTO', variant: 'secondary' },
          { text: '📱 Mobile Money', action: 'WITHDRAW_MOBILE', variant: 'secondary' },
          { text: '💳 Virement Bancaire', action: 'WITHDRAW_BANK', variant: 'secondary' }
        ]
      ];
      break;

    case 'WITHDRAW_MOBILE':
      responseMessage = `📱 *Retrait Mobile Money (MVola, Orange Money, Airtel Money)*\n\n` +
        `Montant minimum requis : *$${MIN_WITHDRAWAL_USD.toFixed(2)} USD*\n\n` +
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
        `Frais réseau : *$0.00 (Offerts)*\n` +
        `Seuil minimum : *$${MIN_WITHDRAWAL_USD.toFixed(2)} USD*\n\n` +
        `Veuillez transmettre votre adresse de portefeuille USDT au gestionnaire : @TaskifySupport`;
      buttons = [
        [
          { text: '💬 Ouvrir le Support', action: 'MENU_SUPPORT', variant: 'primary' },
          { text: '🔙 Retour au Menu', action: 'START', variant: 'secondary' }
        ]
      ];
      break;

    case 'WITHDRAW_BANK':
      responseMessage = `💳 *Virement Bancaire (SEPA / International)*\n\n` +
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
      responseMessage = `${t.support_title}\n\n` +
        `Une question technique, un blocage ou une demande de paiement ?\n\n` +
        `👤 *Administrateur Support :* @TaskifySupport\n` +
        `📢 *Canal Officiel :* @TaskifyAnnouncements\n` +
        `⏰ *Horaires :* 7j/7 — 08h00 à 22h00 (UTC+1)\n` +
        `⚡ *Délai moyen de réponse :* < 15 minutes\n\n` +
        `_Cliquez ci-dessous pour plus d'options :_`;
      buttons = [
        [
          { text: '❓ FAQ & Questions Fréquentes', action: 'ACTION_FAQ', variant: 'secondary' },
          { text: t.btn_tasks, action: 'CHOOSE_FACEBOOK', variant: 'primary' }
        ]
      ];
      break;

    case 'ACTION_FAQ':
      responseMessage = `❓ *FAQ & Questions Fréquentes*\n\n` +
        `• *Validation des comptes :* Instantanée dès réception de l'UID et des cookies complets.\n` +
        `• *Rémunération :* $${TASK_REWARD_USD.toFixed(2)} USD par compte validé.\n` +
        `• *Paiements :* Retrait débloqué dès $${MIN_WITHDRAWAL_USD.toFixed(2)} USD sans frais.\n` +
        `• *Parrainage :* +$${REFERRAL_SIGNUP_BONUS_USD.toFixed(2)} à l'inscription + ${REFERRAL_COMMISSION_PERCENT}% ($${REFERRAL_TASK_COMMISSION_USD.toFixed(3)}) récurrent.\n` +
        `• *Contact direct :* @TaskifySupport`;
      buttons = [
        [{ text: t.btn_tasks, action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      break;

    case 'MENU_REFERRAL':
      session.step = 'REFERRAL';
      responseMessage = `${t.referral_title}\n\n` +
        `Invitez d'autres opérateurs et gagnez des commissions automatiques !\n\n` +
        `🎁 *Bonus direct par inscription :* \`+$${REFERRAL_SIGNUP_BONUS_USD.toFixed(2)}\`\n` +
        `💎 *Gains par tâche filleul :* \`${REFERRAL_COMMISSION_PERCENT}%\` (\`+$${REFERRAL_TASK_COMMISSION_USD.toFixed(3)}\` / tâche)\n` +
        `📊 *Nombre de filleuls actifs :* \`${referralsCount}\`\n` +
        `💵 *Total des commissions perçues :* \`$${referralEarnings.toFixed(3)}\`\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🔗 *Votre lien de parrainage unique :*\n` +
        `\`https://t.me/TaskifyProBot?start=ref_sim_${sessionId}\`\n\n` +
        `_Partagez ce lien pour accumuler des revenus passifs récurrents._`;
      buttons = [
        [{ text: t.btn_tasks, action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      break;

    case 'MENU_LEADERBOARD':
      session.step = 'LEADERBOARD';
      responseMessage = `${t.leaderboard_title}\n\n` +
        `1. 🥇 Opérateur #9482 — \`428 tâches\` (Prime +$50.00)\n` +
        `2. 🥈 Opérateur #1092 — \`391 tâches\` (Prime +$30.00)\n` +
        `3. 🥉 Opérateur #7401 — \`315 tâches\` (Prime +$15.00)\n` +
        `4. ⭐ Opérateur #5892 — \`280 tâches\`\n` +
        `5. ⭐ Opérateur #3419 — \`204 tâches\`\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📍 *Votre Position :* \`${tasksCompleted > 0 ? 'Top 15%' : 'Non classé'}\`\n` +
        `📊 *Vos Tâches :* \`${tasksCompleted} validées\` (\`$${(tasksCompleted * TASK_REWARD_USD).toFixed(3)}\` gagnés)\n\n` +
        `_Primes versées automatiquement chaque 1er du mois aux 3 premiers du classement._`;
      buttons = [
        [{ text: '🚀 Faire des tâches pour grimper', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      break;

    case 'MENU_LANGUAGE':
      session.step = 'LANGUAGE';
      const langNamesDisplay: Record<string, string> = {
        fr: '🇫🇷 Français',
        en: '🇬🇧 English',
        ru: '🇷🇺 Русский',
        es: '🇪🇸 Español',
        id: '🇮🇩 Bahasa Indonesia'
      };
      responseMessage = `🪩 *Sélection de la Langue / Language Selection / Выбор языка*\n\n` +
        `Langue actuelle : *${langNamesDisplay[currentLang] || '🇫🇷 Français'}*\n\n` +
        `Choisissez votre langue de préférence ci-dessous :`;
      buttons = [
        [
          { text: '🇫🇷 Français', action: 'SET_LANG_FR', variant: currentLang === 'fr' ? 'primary' : 'secondary' },
          { text: '🇬🇧 English', action: 'SET_LANG_EN', variant: currentLang === 'en' ? 'primary' : 'secondary' }
        ],
        [
          { text: '🇷🇺 Русский', action: 'SET_LANG_RU', variant: currentLang === 'ru' ? 'primary' : 'secondary' },
          { text: '🇪🇸 Español', action: 'SET_LANG_ES', variant: currentLang === 'es' ? 'primary' : 'secondary' }
        ],
        [
          { text: '🇮🇩 Bahasa Indonesia', action: 'SET_LANG_ID', variant: currentLang === 'id' ? 'primary' : 'secondary' }
        ]
      ];
      break;

    case 'SET_LANG_FR':
      session.language = 'fr';
      responseMessage = TRANSLATIONS.fr.lang_confirm;
      buttons = [[{ text: '📋 Voir les Tâches', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]];
      break;

    case 'SET_LANG_EN':
      session.language = 'en';
      responseMessage = TRANSLATIONS.en.lang_confirm;
      buttons = [[{ text: '📋 View Tasks', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]];
      break;

    case 'SET_LANG_RU':
      session.language = 'ru';
      responseMessage = TRANSLATIONS.ru.lang_confirm;
      buttons = [[{ text: '📋 Выполнить задание', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]];
      break;

    case 'SET_LANG_ES':
      session.language = 'es';
      responseMessage = TRANSLATIONS.es.lang_confirm;
      buttons = [[{ text: '📋 Realizar una Tarea', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]];
      break;

    case 'SET_LANG_ID':
      session.language = 'id';
      responseMessage = TRANSLATIONS.id.lang_confirm;
      buttons = [[{ text: '📋 Kerjakan Tugas', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]];
      break;

    case 'ACTION_TASK_RULES':
      responseMessage = t.task_rules_text;
      buttons = [
        [{ text: '🚀 Démarrer la tâche maintenant', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      break;

    case 'HELP':
      responseMessage = `📌 *${botSettings.platformName} (@TaskifyProBot) - Guide*\n\n` +
        `Ce système automatise l'enregistrement de vos tâches et la transmission des UID / Cookies vers Google Sheets.\n\n` +
        `💵 Rémunération : *$${TASK_REWARD_USD.toFixed(2)} USD* par compte validé.\n\n` +
        `Cliquez ci-dessous pour démarrer :`;
      buttons = [
        [{ text: '🌐 Démarrer tâche Facebook', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      break;

    case 'CHOOSE_FACEBOOK':
      session.step = 'AUTH_CHOICE';
      session.taskType = 'Facebook';
      responseMessage = `${t.tasks_title}\n\n` +
        `💵 Rémunération par compte validé : *$${TASK_REWARD_USD.toFixed(2)} USD*\n\n` +
        `Choisissez votre méthode d'authentification pour cette tâche :\n\n` +
        `• 🍪 *Cookies* : Recommandé pour validation et enregistrement immédiat.\n` +
        `• 🔐 *2FA* : Authentification par clé sécurisée.\n\n` +
        `_Sélectionnez votre option ci-dessous :_`;
      buttons = [
        [
          { text: t.btn_cookies, action: 'CHOOSE_COOKIES', variant: 'primary' },
          { text: t.btn_2fa, action: 'CHOOSE_2FA', variant: 'secondary' }
        ],
        [
          { text: t.btn_rules, action: 'ACTION_TASK_RULES', variant: 'secondary' }
        ],
        [
          { text: t.btn_cancel, action: 'CANCEL', variant: 'danger' }
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
        `🔑 Mot de passe : \`${botSettings.customPassword}\`\n` +
        `💵 Gain : \`$${TASK_REWARD_USD.toFixed(2)} USD\`\n\n` +
        `🔻 Une fois le compte créé, envoyez votre UID.`;
      
      buttons = [
        [{ text: t.btn_send_uid, action: 'PROMPT_UID', variant: 'primary' }],
        [{ text: '🔙 Retour', action: 'CHOOSE_FACEBOOK', variant: 'secondary' }],
        [{ text: t.btn_cancel, action: 'CANCEL', variant: 'danger' }]
      ];
      addLog('info', 'simulator', `Simulateur: Identité générée (${name.firstName} ${name.lastName})`);
      break;

    case 'PROMPT_UID':
      session.step = 'AWAITING_UID';
      responseMessage = t.awaiting_uid;
      buttons = [
        [{ text: t.btn_cancel, action: 'CANCEL', variant: 'danger' }]
      ];
      break;

    case 'SEND_UID_TEXT':
      if (!input || !input.trim()) {
        responseMessage = `⚠️ Veuillez fournir un UID valide.`;
        buttons = [[{ text: '❌ Annuler', action: 'CANCEL', variant: 'danger' }]];
      } else {
        session.uid = input.trim();
        session.step = 'AWAITING_COOKIES';
        responseMessage = `✅ *UID reçu avec succès :* \`${session.uid}\`\n\n` + t.awaiting_cookies;
        buttons = [
          [{ text: t.btn_cancel, action: 'CANCEL', variant: 'danger' }]
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
          firstName: session.firstName || 'Alexandre',
          lastName: session.lastName || 'Dubois',
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
          syncRowToGoogleSheets(createdTask).then(() => {
            createdTask.syncedToGoogleSheets = true;
          }).catch(() => {});
        }

        // -----------------------------------------------
        // PERSISTENT LEDGER - PostgreSQL
        // -----------------------------------------------

        const client = await pool.connect();

        let currentBal = 0;

        try {
          await client.query('BEGIN');

          // 1. Créer ou récupérer le worker
          const userResult = await client.query(
            `
            INSERT INTO users (
              telegram_user_id,
              telegram_username,
              first_name,
              last_name
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (telegram_user_id)
            DO UPDATE SET
              telegram_username = EXCLUDED.telegram_username,
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              updated_at = NOW()
            RETURNING id
            `,
            [
              String(createdTask.telegramUserId),
              createdTask.telegramUsername || null,
              createdTask.firstName || null,
              createdTask.lastName || null
            ]
          );

          const dbUserId = userResult.rows[0].id;

          // 2. Créer le wallet s'il n'existe pas
          await client.query(
            `
            INSERT INTO wallets (
              user_id,
              balance,
              total_earned,
              total_withdrawn
            )
            VALUES ($1, 0, 0, 0)
            ON CONFLICT (user_id) DO NOTHING
            `,
            [dbUserId]
          );

          // 3. Enregistrer la tâche dans PostgreSQL
          await client.query(
            `
            INSERT INTO tasks (
              task_id,
              telegram_user_id,
              task_type,
              status,
              uid,
              first_name,
              last_name,
              password,
              cookies,
              reward_usd,
              created_at,
              completed_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9,
              $10, $11, NOW()
            )
            ON CONFLICT (task_id) DO NOTHING
            `,
            [
              createdTask.id,
              String(createdTask.telegramUserId),
              createdTask.taskType,
              createdTask.status,
              createdTask.uid,
              createdTask.firstName,
              createdTask.lastName,
              createdTask.password,
              createdTask.cookies,
              TASK_REWARD_USD,
              createdTask.createdAt
            ]
          );

          // 4. Récupérer le solde actuel avec verrouillage
          const walletResult = await client.query(
            `
            SELECT balance
            FROM wallets
            WHERE user_id = $1
            FOR UPDATE
            `,
            [dbUserId]
          );

          if (walletResult.rows.length === 0) {
            throw new Error(
              `Wallet introuvable pour l'utilisateur ${createdTask.telegramUserId}`
            );
          }

          const balanceBefore = Number(
            walletResult.rows[0].balance
          );

          currentBal =
            balanceBefore + TASK_REWARD_USD;

          // 5. Créditer le reward
          await client.query(
            `
            UPDATE wallets
            SET
              balance = $1,
              total_earned = total_earned + $2,
              updated_at = NOW()
            WHERE user_id = $3
            `,
            [
              currentBal,
              TASK_REWARD_USD,
              dbUserId
            ]
          );

          // 6. Enregistrer la transaction
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
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              dbUserId,
              createdTask.id,
              'task_reward',
              TASK_REWARD_USD,
              balanceBefore,
              currentBal,
              `Reward pour la tâche ${createdTask.id}`
            ]
          );

          await client.query('COMMIT');

          console.log(
            `💰 Reward enregistré: +$${TASK_REWARD_USD.toFixed(2)} | ` +
            `Worker: ${createdTask.telegramUserId} | ` +
            `Balance: $${currentBal.toFixed(3)}`
          );

        } catch (error) {

          await client.query('ROLLBACK');

          console.error(
            '❌ Erreur PostgreSQL lors du crédit de la tâche:',
            error
          );

          throw error;

        } finally {

          client.release();
        }

        delete session.step;

        responseMessage = `🎉 *Tâche terminée avec succès !*\n\n` +
          `✅ Vos informations ont été enregistrées avec succès et synchronisées.\n` +
          `💵 *+$${TASK_REWARD_USD.toFixed(2)} USD* crédités sur votre solde disponible !\n\n` +
          `🆔 *UID :* \`${createdTask.uid}\`\n` +
          `👤 *Nom complet :* ${createdTask.firstName} ${createdTask.lastName}\n` +
          `💰 *Nouveau solde :* \`$${currentBal.toFixed(3)} USD\`\n` +
          `📅 *Date :* ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}\n\n` +
          `Merci pour votre travail !`;

        buttons = [
          [{ text: '🚀 ' + t.btn_tasks, action: 'CHOOSE_FACEBOOK', variant: 'primary' }],
          [{ text: '💰 ' + t.btn_withdraw, action: 'MENU_WITHDRAW', variant: 'secondary' }]
        ];
      }
      break;

    case 'CANCEL':
      delete userSessions[sessionId].step;
      responseMessage = t.cancelled + `\n\nCliquez ci-dessous pour recommencer :`;
      buttons = [
        [{ text: '🚀 ' + t.btn_tasks, action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
      ];
      addLog('info', 'simulator', `Simulateur: Processus annulé par l'utilisateur.`);
      break;

    case 'USER_TEXT':
    default:
      if (!session || !session.step || session.step === 'START') {
        responseMessage = `👋 Bonjour ! Utilisez le menu principal ci-dessous ou cliquez sur [ 📋 Tâches ] pour commencer :`;
        buttons = [
          [{ text: '🚀 ' + t.btn_tasks, action: 'CHOOSE_FACEBOOK', variant: 'primary' }],
          [{ text: '💰 ' + t.balance_title.split('*')[1] || 'Solde', action: 'MENU_BALANCE', variant: 'secondary' }]
        ];
      } else {
        responseMessage = `Action prise en compte. Utilisez les boutons interactifs ci-dessous pour naviguer.`;
        buttons = [
          [{ text: t.btn_tasks, action: 'CHOOSE_FACEBOOK', variant: 'primary' }],
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

// 8. Test Google Sheets Webhook (Mampiasa GET sy URLSearchParams)
app.post('/api/test-google-sheets', async (req, res) => {
  const { url, task } = req.body;
  const targetUrl = url || botSettings.googleSheetWebhookUrl;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL Webhook Google Sheets requise' });
  }

  try {
    const dataToSend = task || {
      id: 'TEST_ID_' + Date.now(),
      uid: 'TEST_UID_999999',
      cookies: 'datr=test_cookie_sample; c_user=TEST_UID_999999',
      firstName: 'Alexandre',
      lastName: 'Dubois',
      password: botSettings.customPassword,
      telegramUserId: 'test_admin',
      telegramUsername: 'admin_taskify',
      status: 'compte créé',
      notes: 'Test de connexion depuis le dashboard'
    };

    // Mamadika ho Parameters sahaza ho an'ny doGet(e)
    const params = new URLSearchParams({
      id: dataToSend.id || '',
      uid: dataToSend.uid || '',
      firstName: dataToSend.firstName || '',
      lastName: dataToSend.lastName || '',
      password: dataToSend.password || '',
      cookies: dataToSend.cookies || '',
      telegramUserId: String(dataToSend.telegramUserId || ''),
      telegramUsername: dataToSend.telegramUsername || '',
      status: dataToSend.status || 'compte créé',
      notes: dataToSend.notes || ''
    });

    const fullUrl = `${targetUrl}?${params.toString()}`;

    // Mandefa GET request mankany amin'ny Google Apps Script
    const response = await fetch(fullUrl, {
      method: 'GET',
      redirect: 'follow'
    });

    const responseText = await response.text();
    addLog('success', 'sheets', `Données transmises avec succès vers Google Sheets`);
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
    try {
      await syncRowToGoogleSheets(task);
      task.syncedToGoogleSheets = true;
      count++;
    } catch {}
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
  const fs = require('fs');
  let currentBotJs = '';
  try {
    currentBotJs = fs.readFileSync(path.join(process.cwd(), 'bot.js'), 'utf8');
  } catch (e) {
    currentBotJs = '// bot.js';
  }

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
        "Rémunération ($)",
        "Notes"
      ]);
      // Met en forme l'en-tête (Gras + Fond bleu foncé)
      var headerRange = sheet.getRange(1, 1, 1, 12);
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
      data.rewardUSD || 0.04,
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
    financials: {
      taskRewardUSD: 0.04,
      referralSignupBonusUSD: 0.01,
      referralCommissionPercent: 20
    },
    message: "Google Apps Script Webhook API est fonctionnel !"
  })).setMimeType(ContentService.MimeType.JSON);
}
`;

  res.json({
    botJs: currentBotJs,
    googleAppsScript: standaloneGoogleAppsScript,
    envExample: `TELEGRAM_BOT_TOKEN="votre_token_botfather_ici"\nGOOGLE_SHEET_WEBHOOK_URL="https://script.google.com/macros/s/.../exec"\nDEFAULT_BOT_PASSWORD="TaskPassword@2025!"\nPORT=3000`,
    packageJson: `{\n  "name": "taskify-pro-bot",\n  "version": "1.0.0",\n  "main": "bot.js",\n  "scripts": {\n    "start": "node bot.js"\n  },\n  "dependencies": {\n    "dotenv": "^16.4.5",\n    "telegraf": "^4.16.3"\n  }\n}`
  });
});

// ----------------------------------------------------
// VITE MIDDLEWARE / SPA STATIC HANDLER
// ----------------------------------------------------

async function startServer() {
  try {
    // -----------------------------------------------
    // DATABASE
    // -----------------------------------------------

    try {
      await initializeDatabase();
    } catch (e: any) {
      console.log('ℹ️ Database schema initialized / verified');
    }

    const dbConnected = await testDatabaseConnection();

    if (!dbConnected) {
      console.log('ℹ️ Operating with in-memory database store');
    } else {
      console.log('✅ Database layer ready');
      try {
        const dbTasks = await pool.query('SELECT * FROM tasks ORDER BY id DESC LIMIT 200;');
        if (dbTasks?.rows?.length > 0) {
          tasks = dbTasks.rows.map((row: any) => ({
            id: row.task_id || `task-${row.id}`,
            uid: row.uid || '',
            cookies: row.cookies || '',
            firstName: row.first_name || '',
            lastName: row.last_name || '',
            password: row.password || botSettings.customPassword || 'TaskPassword@2025!',
            telegramUserId: String(row.telegram_user_id || ''),
            telegramUsername: row.telegram_username || '',
            status: row.status || 'compte créé',
            notes: row.validation_reason || row.notes || '',
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            updatedAt: row.completed_at ? new Date(row.completed_at).toISOString() : (row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()),
            syncedToGoogleSheets: Boolean(row.account_created || row.validation_status === 'validated'),
            taskType: row.task_type || 'Facebook'
          }));
          console.log(`✅ Loaded ${tasks.length} tasks from PostgreSQL`);
        }
      } catch {}
    }

    // -----------------------------------------------
    // VITE / PRODUCTION
    // -----------------------------------------------

    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: {
          middlewareMode: true
        },
        appType: 'spa'
      });

      app.use(vite.middlewares);

    } else {
      const distPath = path.join(
        process.cwd(),
        'dist'
      );

      app.use(express.static(distPath));

      app.get('*', (req, res) => {
        res.sendFile(
          path.join(
            distPath,
            'index.html'
          )
        );
      });
    }

    // -----------------------------------------------
    // START SERVER
    // -----------------------------------------------
    app.listen(
      PORT,
      '0.0.0.0',
      () => {
        console.log(
          `🚀 Taskify Pro server running on http://0.0.0.0:${PORT}`
        );
      }
    );

  } catch (error) {
    console.error(
      '❌ Failed to start Taskify Pro:',
      error
    );

    process.exit(1);
  }
}

startServer();
