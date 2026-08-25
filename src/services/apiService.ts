import { TaskRecord, BotSettings, BotLog, TaskStatus } from '../types';
import { INITIAL_TASKS } from '../data/mockTasks';

const STORAGE_KEYS = {
  TASKS: 'taskify_pro_prod_tasks_v2',
  SETTINGS: 'taskify_pro_prod_settings_v2',
  LOGS: 'taskify_pro_prod_logs_v2'
};

const DEFAULT_SETTINGS: BotSettings = {
  botToken: '',
  customPassword: 'TaskPassword@2025!',
  googleSheetWebhookUrl: '',
  platformName: 'Taskify Pro',
  isBotActive: false,
  mode: 'polling',
  welcomeMessage: 'Bienvenue sur Taskify Pro (@TaskifyProBot)'
};

const INITIAL_LOGS: BotLog[] = [];

// Helper to safely parse JSON response or return null
async function safeFetchJson<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

// Local Storage helpers
export function getLocalTasks(): TaskRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalTasks(tasks: TaskRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch {}
}

export function getLocalSettings(): BotSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveLocalSettings(settings: BotSettings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch {}
}

export function getLocalLogs(): BotLog[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalLogs(logs: BotLog[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs.slice(0, 100)));
  } catch {}
}

export function addClientLog(
  type: 'info' | 'success' | 'warning' | 'error',
  source: 'telegram' | 'sheets' | 'system' | 'simulator',
  message: string,
  data?: any
): BotLog {
  const current = getLocalLogs();
  const newLog: BotLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    type,
    source,
    message,
    data
  };
  const updated = [newLog, ...current].slice(0, 100);
  saveLocalLogs(updated);
  return newLog;
}

// ----------------------------------------------------
// HYBRID API SERVICE (Seamless Server + Local Fallback)
// ----------------------------------------------------

export async function fetchTasks(): Promise<TaskRecord[]> {
  const serverData = await safeFetchJson<TaskRecord[]>('/api/tasks');
  if (serverData && Array.isArray(serverData)) {
    saveLocalTasks(serverData);
    return serverData;
  }
  return getLocalTasks();
}

export async function fetchSettings(): Promise<BotSettings> {
  const serverData = await safeFetchJson<BotSettings>('/api/settings');
  if (serverData && typeof serverData === 'object' && serverData.platformName) {
    saveLocalSettings(serverData);
    return serverData;
  }
  return getLocalSettings();
}

export async function fetchLogs(): Promise<BotLog[]> {
  const serverData = await safeFetchJson<BotLog[]>('/api/logs');
  if (serverData && Array.isArray(serverData)) {
    saveLocalLogs(serverData);
    return serverData;
  }
  return getLocalLogs();
}

export async function updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<TaskRecord[]> {
  // Update local store first
  const current = getLocalTasks();
  const updated = current.map(t => t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t);
  saveLocalTasks(updated);
  
  addClientLog(
    newStatus === 'compte suspendu' ? 'warning' : 'info',
    'system',
    `Statut mis à jour : "${newStatus}"`
  );

  // Try server sync
  safeFetchJson(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  }).catch(() => {});

  return updated;
}

export async function updateTask(taskId: string, updates: Partial<TaskRecord>): Promise<TaskRecord[]> {
  const current = getLocalTasks();
  const updated = current.map(t => t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t);
  saveLocalTasks(updated);

  safeFetchJson(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  }).catch(() => {});

  return updated;
}

export async function deleteTask(taskId: string): Promise<TaskRecord[]> {
  const current = getLocalTasks();
  const target = current.find(t => t.id === taskId);
  const updated = current.filter(t => t.id !== taskId);
  saveLocalTasks(updated);

  if (target) {
    addClientLog('warning', 'system', `Tâche supprimée (UID: ${target.uid})`);
  }

  safeFetchJson(`/api/tasks/${taskId}`, { method: 'DELETE' }).catch(() => {});

  return updated;
}

export async function createTask(taskData: Partial<TaskRecord>, settings: BotSettings): Promise<{ newTask: TaskRecord; allTasks: TaskRecord[] }> {
  const FIRST_NAMES = ['Alexandre', 'Thomas', 'Julien', 'Nicolas', 'Maxime', 'Lucas', 'Antoine', 'Romain', 'Camille', 'Emma', 'Léa', 'Chloé', 'Sarah'];
  const LAST_NAMES = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Laurent', 'Dupont'];
  
  const generatedFirst = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const generatedLast = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

  const newTask: TaskRecord = {
    id: `task-${Date.now()}`,
    uid: taskData.uid || '1000' + Math.floor(10000000000 + Math.random() * 90000000000),
    cookies: taskData.cookies || '',
    firstName: taskData.firstName || generatedFirst,
    lastName: taskData.lastName || generatedLast,
    password: taskData.password || settings.customPassword || 'TaskPassword@2025!',
    telegramUserId: taskData.telegramUserId || 'manual_admin',
    telegramUsername: taskData.telegramUsername || 'admin_portal',
    status: (taskData.status || 'compte créé') as TaskStatus,
    notes: taskData.notes || 'Ajouté manuellement depuis le Dashboard',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncedToGoogleSheets: false,
    taskType: taskData.taskType || 'Facebook'
  };

  const current = getLocalTasks();
  const updated = [newTask, ...current];
  saveLocalTasks(updated);

  addClientLog('info', 'system', `Nouvelle tâche ajoutée (UID: ${newTask.uid})`, newTask);

  // Sync to Google Sheets if configured
  if (settings.googleSheetWebhookUrl) {
    sendToGoogleSheetsWebhook(newTask, settings.googleSheetWebhookUrl).then(res => {
      if (res.success) {
        newTask.syncedToGoogleSheets = true;
        saveLocalTasks([newTask, ...current]);
      }
    });
  }

  // Try server sync
  safeFetchJson<TaskRecord>('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData)
  }).catch(() => {});

  return { newTask, allTasks: updated };
}

export async function saveSettings(newSettings: Partial<BotSettings>): Promise<BotSettings> {
  const current = getLocalSettings();
  const updated = { ...current, ...newSettings };
  saveLocalSettings(updated);

  addClientLog('info', 'system', `Paramètres mis à jour (Mot de passe: ${updated.customPassword})`);

  safeFetchJson<BotSettings>('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newSettings)
  }).catch(() => {});

  return updated;
}

// ----------------------------------------------------
// BOT SIMULATOR ENGINE (Hybrid Server + Client Fallback)
// ----------------------------------------------------
interface SimulatorStepResponse {
  step: string;
  message: string;
  buttons?: { text: string; action: string; variant?: 'primary' | 'secondary' | 'danger' }[][];
  createdTask?: TaskRecord;
}

const localSimSessions: Record<string, {
  step: string;
  taskType?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  uid?: string;
  cookies?: string;
}> = {};

export async function simulateBotStep(
  sessionId: string,
  action: string,
  input?: string,
  currentSettings?: BotSettings
): Promise<SimulatorStepResponse> {
  const activeSettings = currentSettings || getLocalSettings();

  // Try server first
  const serverResult = await safeFetchJson<SimulatorStepResponse>('/api/bot/simulate-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, action, input })
  });

  if (serverResult && serverResult.message) {
    return serverResult;
  }

  // Client-side fallback state machine
  if (!localSimSessions[sessionId]) {
    localSimSessions[sessionId] = { step: 'START' };
  }
  const session = localSimSessions[sessionId];

  const FIRST_NAMES = ['Alexandre', 'Thomas', 'Julien', 'Nicolas', 'Maxime', 'Lucas', 'Antoine', 'Camille', 'Emma', 'Léa'];
  const LAST_NAMES = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Laurent', 'Dupont'];

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
      return {
        step: 'START',
        message: `👋 Bienvenue sur ${activeSettings.platformName} (@TaskifyProBot) !\n\nUtilisez le menu principal ci-dessous pour gérer vos tâches, suivre vos gains ou demander un retrait.\n\n👉 Cliquez sur [ 📋 Tâches ] pour commencer.`,
        buttons: [
          [
            { text: '🌐 Facebook', action: 'CHOOSE_FACEBOOK', variant: 'primary' },
            { text: 'ℹ️ Consignes & Règles', action: 'ACTION_TASK_RULES', variant: 'secondary' }
          ]
        ]
      };

    case 'MENU_BALANCE':
      return {
        step: 'BALANCE',
        message: `💰 *Votre Solde & Activité*\n\n👤 Utilisateur : Opérateur Simulateur\n💵 Solde validé disponible : 0.00 €\n⏳ En cours de validation : 0.00 €\n📊 Tâches totales enregistrées : 0\n👥 Filleuls actifs : 0 (+0.00 €)\n\n_Taux de rémunération : 1.50 € par compte Facebook validé._`,
        buttons: [
          [
            { text: '📋 Effectuer une Tâche', action: 'CHOOSE_FACEBOOK', variant: 'primary' },
            { text: '🏦 Demander un Retrait', action: 'MENU_WITHDRAW', variant: 'secondary' }
          ]
        ]
      };

    case 'MENU_WITHDRAW':
      return {
        step: 'WITHDRAW',
        message: `🏦 *Demande de Retrait de Gains*\n\n💵 Solde disponible : 0.00 €\n🎯 Seuil minimum de retrait : 10.00 €\n\nMoyens de paiement supportés :\n• 📱 Mobile Money (MVola, Orange Money, Airtel Money)\n• 🪙 Crypto (USDT TRC20 / BEP20)\n• 💳 Virement Bancaire SEPA\n\n_Sélectionnez votre mode de retrait :_`,
        buttons: [
          [
            { text: '📱 Mobile Money', action: 'WITHDRAW_MOBILE', variant: 'secondary' },
            { text: '🪙 Crypto (USDT)', action: 'WITHDRAW_CRYPTO', variant: 'secondary' },
            { text: '💳 Virement Bancaire', action: 'WITHDRAW_BANK', variant: 'secondary' }
          ]
        ]
      };

    case 'WITHDRAW_MOBILE':
      return {
        step: 'WITHDRAW_INFO',
        message: `📱 *Retrait Mobile Money (MVola, Orange Money, Airtel Money)*\n\nMontant minimum : 10.00 €\n\nPour soumettre votre demande, transmettez votre numéro de téléphone et opérateur au support officiel : @TaskifySupport`,
        buttons: [
          [{ text: '🔙 Retour au Menu', action: 'START', variant: 'secondary' }]
        ]
      };

    case 'WITHDRAW_CRYPTO':
      return {
        step: 'WITHDRAW_INFO',
        message: `🪙 *Retrait Crypto USDT (TRC-20 / BEP-20)*\n\nFrais réseau : 0 € (Offerts)\n\nVeuillez transmettre votre adresse de portefeuille USDT au gestionnaire : @TaskifySupport`,
        buttons: [
          [{ text: '🔙 Retour au Menu', action: 'START', variant: 'secondary' }]
        ]
      };

    case 'WITHDRAW_BANK':
      return {
        step: 'WITHDRAW_INFO',
        message: `💳 *Virement Bancaire (SEPA)*\n\nDélai de traitement : 24h à 48h ouvrées.\nTransmettez votre IBAN au support : @TaskifySupport`,
        buttons: [
          [{ text: '🔙 Retour au Menu', action: 'START', variant: 'secondary' }]
        ]
      };

    case 'MENU_SUPPORT':
      return {
        step: 'SUPPORT',
        message: `📞 *Support & Assistance Opérateurs*\n\n• Administrateur Support : @TaskifySupport\n• Canal des Annonces : @TaskifyAnnouncements\n• Horaires : 7j/7 de 08:00 à 22:00 (UTC+1)\n• Délai moyen de réponse : < 15 min`,
        buttons: [
          [
            { text: '❓ FAQ & Questions', action: 'ACTION_FAQ', variant: 'secondary' },
            { text: '🚀 Démarrer une Tâche', action: 'CHOOSE_FACEBOOK', variant: 'primary' }
          ]
        ]
      };

    case 'ACTION_FAQ':
      return {
        step: 'FAQ',
        message: `❓ *FAQ & Questions Fréquentes*\n\n• *Validation :* Instantanée dès réception de l'UID et des Cookies.\n• *Paiements :* Retrait débloqué dès 10.00 € via Mobile Money ou USDT.\n• *Aide :* Écrivez à @TaskifySupport`,
        buttons: [
          [{ text: '🚀 Démarrer une Tâche', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
        ]
      };

    case 'MENU_REFERRAL':
      return {
        step: 'REFERRAL',
        message: `👥 *Programme de Parrainage*\n\nInvitez d'autres opérateurs et touchez des commissions automatiques !\n\n💎 Commission : +0.25 € par tâche validée par vos filleuls\n📊 Filleuls actifs : 0\n💵 Commissions perçues : 0.00 €\n\n🔗 *Lien unique de parrainage :*\nhttps://t.me/TaskifyProBot?start=ref_sim10001`,
        buttons: [
          [{ text: '🚀 Faire des tâches', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
        ]
      };

    case 'MENU_LEADERBOARD':
      return {
        step: 'LEADERBOARD',
        message: `🏆 *Classement des Meilleurs Opérateurs*\n\n1. 🥇 Opérateur #9482 — 428 tâches (+50.00 €)\n2. 🥈 Opérateur #1092 — 391 tâches (+30.00 €)\n3. 🥉 Opérateur #7401 — 315 tâches (+15.00 €)\n4. ⭐ Opérateur #5892 — 280 tâches\n5. ⭐ Opérateur #3419 — 204 tâches\n\n📍 Votre position : Top 15%`,
        buttons: [
          [{ text: '🚀 Démarrer une Tâche', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
        ]
      };

    case 'MENU_LANGUAGE':
      return {
        step: 'LANGUAGE',
        message: `🪩 *Sélection de la Langue / Language / Fiteny*\n\nLangue active : 🇫🇷 Français\n\nSélectionnez une langue :`,
        buttons: [
          [
            { text: '🇫🇷 Français', action: 'SET_LANG_FR', variant: 'primary' },
            { text: '🇲🇬 Malagasy', action: 'SET_LANG_MG', variant: 'secondary' },
            { text: '🇬🇧 English', action: 'SET_LANG_EN', variant: 'secondary' }
          ]
        ]
      };

    case 'SET_LANG_FR':
      return {
        step: 'LANGUAGE_SET',
        message: `✅ La langue du bot reste configurée en **Français**.`,
        buttons: [[{ text: '📋 Voir les Tâches', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]]
      };

    case 'SET_LANG_MG':
      return {
        step: 'LANGUAGE_SET',
        message: `✅ Voafaritra amin'ny teny **Malagasy** ny bot.`,
        buttons: [[{ text: '📋 Hanao Asa (Tâches)', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]]
      };

    case 'SET_LANG_EN':
      return {
        step: 'LANGUAGE_SET',
        message: `🌐 Language updated to **English**.`,
        buttons: [[{ text: '📋 View Tasks', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]]
      };

    case 'ACTION_TASK_RULES':
      return {
        step: 'TASK_RULES',
        message: `📋 *Règles de Création Facebook*\n\n1. Utilisez le nom français et mot de passe générés.\n2. Exportez les cookies complets au format standard.\n3. Ne réutilisez pas le même UID deux fois.`,
        buttons: [
          [{ text: '✅ Compris, démarrer', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
        ]
      };

    case 'HELP':
      return {
        step: 'HELP',
        message: `📌 Taskify Pro (@TaskifyProBot) - Aide\n\nCe système automatise l'enregistrement de vos tâches et la transmission des UID / Cookies vers Google Sheets.\n\nCliquez ci-dessous pour démarrer.`,
        buttons: [
          [{ text: '🌐 Démarrer tâche Facebook', action: 'CHOOSE_FACEBOOK', variant: 'primary' }]
        ]
      };

    case 'CHOOSE_FACEBOOK':
      session.step = 'AUTH_CHOICE';
      session.taskType = 'Facebook';
      return {
        step: 'AUTH_CHOICE',
        message: `🌐 Tâche : Facebook\n\nChoisissez votre méthode d'authentification :`,
        buttons: [
          [
            { text: '🍪 Cookies', action: 'CHOOSE_COOKIES', variant: 'primary' },
            { text: '🔐 2FA', action: 'CHOOSE_2FA', variant: 'secondary' }
          ],
          [
            { text: '❌ Annuler', action: 'CANCEL', variant: 'danger' }
          ]
        ]
      };

    case 'CHOOSE_2FA':
      session.step = '2FA_NOTICE';
      return {
        step: '2FA_NOTICE',
        message: `⚠️ Authentification 2FA non disponible\n\nLa méthode 2FA est suspendue pour ce type de tâche. Veuillez impérativement utiliser l'authentification par Cookies.\n\nCliquez sur le bouton ci-dessous pour recommencer :`,
        buttons: [
          [
            { text: '🔄 Choisir Cookies', action: 'CHOOSE_COOKIES', variant: 'primary' },
            { text: '↩️ Menu Principal', action: 'START', variant: 'secondary' }
          ]
        ]
      };

    case 'CHOOSE_COOKIES':
      const fName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      session.firstName = fName;
      session.lastName = lName;
      session.password = activeSettings.customPassword;
      session.step = 'CREDENTIALS_SHOWN';
      return {
        step: 'CREDENTIALS_SHOWN',
        message: `⚠️ *Informations du compte Facebook*\n\n✅ Prénom : \`${fName}\`\n✅ Nom : \`${lName}\`\n🇫🇷 Mot de passe : \`${activeSettings.customPassword}\`\n\n🔻 Une fois le compte créé, envoyez votre UID.`,
        buttons: [
          [{ text: '📥 Envoyer l\'UID', action: 'PROMPT_UID', variant: 'primary' }],
          [{ text: '🔙 Retour', action: 'CHOOSE_FACEBOOK', variant: 'secondary' }],
          [{ text: '❌ Annuler le processus', action: 'CANCEL', variant: 'danger' }]
        ]
      };

    case 'PROMPT_UID':
      session.step = 'AWAITING_UID';
      return {
        step: 'AWAITING_UID',
        message: `✍️ Étape 1/2 : Envoi de l'UID\n\nVeuillez saisir ou coller votre UID Facebook dans le champ texte ci-dessous (ex: 100084928172910) :`,
        buttons: [
          [{ text: '❌ Annuler', action: 'CANCEL', variant: 'danger' }]
        ]
      };

    case 'SEND_UID_TEXT':
      session.uid = input?.trim() || '1000' + Math.floor(10000000000 + Math.random() * 90000000000);
      session.step = 'AWAITING_COOKIES';
      return {
        step: 'AWAITING_COOKIES',
        message: `✅ UID reçu avec succès : ${session.uid}\n\n🍪 Étape 2/2 : Envoi des Cookies\n\nVeuillez maintenant coller vos Cookies Facebook (ex: datr=...; c_user=...; xs=...) :`,
        buttons: [
          [{ text: '❌ Annuler', action: 'CANCEL', variant: 'danger' }]
        ]
      };

    case 'SEND_COOKIES_TEXT':
      session.cookies = input?.trim() || 'datr=sample_auto_cookie; c_user=' + (session.uid || '1000');
      const newTaskResult = await createTask({
        uid: session.uid || '1000' + Math.floor(10000000000 + Math.random() * 90000000000),
        cookies: session.cookies,
        firstName: session.firstName || 'Généré',
        lastName: session.lastName || 'Auto',
        password: session.password || activeSettings.customPassword,
        telegramUserId: 'sim_' + sessionId,
        telegramUsername: 'simulateur_user',
        status: 'compte créé',
        notes: 'Enregistré via le Simulateur de Bot interactif',
        taskType: session.taskType || 'Facebook'
      }, activeSettings);

      delete localSimSessions[sessionId];

      return {
        step: 'COMPLETED',
        message: `🎉 Tâche terminée avec succès !\n\n✅ Vos informations ont été enregistrées avec succès dans le tableau de bord et synchronisées.\n\n🆔 UID : ${newTaskResult.newTask.uid}\n👤 Nom complet : ${newTaskResult.newTask.firstName} ${newTaskResult.newTask.lastName}\n📅 Date : ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}\n\nMerci pour votre travail !`,
        buttons: [
          [{ text: '🚀 Nouvelle Tâche', action: 'START', variant: 'primary' }]
        ],
        createdTask: newTaskResult.newTask
      };

    case 'CANCEL':
    default:
      delete localSimSessions[sessionId];
      return {
        step: 'START',
        message: `❌ Processus annulé.\n\nAucune donnée n'a été enregistrée. Cliquez ci-dessous pour recommencer :`,
        buttons: [
          [{ text: '🔄 Recommencer', action: 'START', variant: 'primary' }]
        ]
      };
  }
}

export async function sendToGoogleSheetsWebhook(task: TaskRecord, webhookUrl: string): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, error: 'URL Google Sheets non configurée' };
  }

  const payload = {
    action: 'insert_task',
    id: task.id,
    timestamp: task.createdAt,
    uid: task.uid,
    cookies: task.cookies,
    firstName: task.firstName,
    lastName: task.lastName,
    password: task.password,
    telegramUserId: task.telegramUserId,
    telegramUsername: task.telegramUsername,
    status: task.status,
    notes: task.notes || '',
    taskType: task.taskType || 'Facebook'
  };

  try {
    // Attempt via backend proxy first
    const proxyRes = await safeFetchJson<{ success: boolean; error?: string }>('/api/test-google-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, task: payload })
    });

    if (proxyRes && proxyRes.success) {
      addClientLog('success', 'sheets', `Synchronisé avec Google Sheets pour UID: ${task.uid}`);
      return { success: true, message: 'Synchronisé via serveur' };
    }

    // Direct fetch with no-cors support as standard Apps Script Web App
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    addClientLog('success', 'sheets', `Données transmises au Webhook Google Sheets pour UID: ${task.uid}`);
    return { success: true, message: 'Transmis au Webhook Google Sheets' };
  } catch (err: any) {
    addClientLog('error', 'sheets', `Erreur Webhook Google Sheets: ${err.message}`);
    return { success: false, error: err.message };
  }
}


