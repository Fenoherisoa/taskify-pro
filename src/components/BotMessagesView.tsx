import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Globe, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Eye, 
  MessageSquare, 
  Check, 
  Send,
  HelpCircle
} from 'lucide-react';
import { BotMessagesConfig } from '../types';
import { fetchBotMessagesApi, saveBotMessagesApi, resetBotMessagesApi } from '../services/apiService';

type SupportedTab = 'fr' | 'en' | 'mg';

interface MessageFieldDef {
  key: string;
  label: string;
  description: string;
  category: 'welcome' | 'tasks' | 'verification' | 'withdrawals' | 'wallet' | 'buttons';
  multiline?: boolean;
  variables?: string[];
}

const MESSAGE_DEFINITIONS: MessageFieldDef[] = [
  // Welcome & Onboarding
  {
    key: 'welcome',
    label: 'Message de Bienvenue (/start)',
    description: 'Premier message envoyé lorsque l\'utilisateur démarre le bot ou tape /start.',
    category: 'welcome',
    multiline: true
  },
  {
    key: 'lang_title',
    label: 'Titre du Menu Langue',
    description: 'Affiché lors du choix de langue par l\'utilisateur.',
    category: 'welcome'
  },
  {
    key: 'lang_confirm',
    label: 'Confirmation de Changement de Langue',
    description: 'Envoyé immédiatement après que l\'utilisateur a choisi cette langue.',
    category: 'welcome'
  },
  {
    key: 'support_title',
    label: 'Message du Support & Assistance',
    description: 'Coordonnées de l\'équipe d\'assistance affichées lors du clic sur Support.',
    category: 'welcome',
    multiline: true
  },

  // Task & Rules
  {
    key: 'tasks_title',
    label: 'En-tête de Tâche Facebook',
    description: 'Titre lors de l\'initialisation d\'une nouvelle tâche Facebook.',
    category: 'tasks'
  },
  {
    key: 'cookies_reward_notice',
    label: 'Notification de Rémunération',
    description: 'Indication du montant accordé par compte validé.',
    category: 'tasks'
  },
  {
    key: 'task_rules_text',
    label: 'Consignes & Règles Complètes',
    description: 'Directives de création de compte et extraction de cookies.',
    category: 'tasks',
    multiline: true
  },
  {
    key: 'awaiting_uid',
    label: 'Invite Étape 1 : Envoi de l\'UID',
    description: 'Message demandant à l\'opérateur de coller son UID Facebook.',
    category: 'tasks',
    multiline: true
  },
  {
    key: 'awaiting_cookies',
    label: 'Invite Étape 2 : Envoi des Cookies',
    description: 'Message demandant de coller les cookies formatés (c_user, datr, xs).',
    category: 'tasks',
    multiline: true
  },
  {
    key: 'cancelled',
    label: 'Annulation du Processus',
    description: 'Message confirmant que la tâche en cours a été annulée.',
    category: 'tasks',
    multiline: true
  },

  // Verification & Rewards
  {
    key: 'verification_verified',
    label: 'Notification de Compte Vérifié (Gain crédité)',
    description: 'Envoyé au travailleur dès validation par l\'admin. Variables : {reward}, {balance}',
    category: 'verification',
    multiline: true,
    variables: ['{reward}', '{balance}']
  },
  {
    key: 'verification_rejected',
    label: 'Notification de Compte Rejeté',
    description: 'Envoyé au travailleur si le compte est refusé. Variables : {reason}, {balance}',
    category: 'verification',
    multiline: true,
    variables: ['{reason}', '{balance}']
  },

  // Withdrawals & Financial
  {
    key: 'withdrawal_title',
    label: 'Titre de l\'interface Retrait',
    description: 'En-tête de la demande de retrait.',
    category: 'withdrawals'
  },
  {
    key: 'withdrawal_pending',
    label: 'Notification Retrait en Attente',
    description: 'Envoyé dès que le travailleur soumet sa demande de retrait.',
    category: 'withdrawals',
    multiline: true
  },
  {
    key: 'withdrawal_approved',
    label: 'Notification Retrait Approuvé',
    description: 'Envoyé quand l\'admin approuve la demande avant paiement.',
    category: 'withdrawals',
    multiline: true
  },
  {
    key: 'withdrawal_paid',
    label: 'Notification Paiement Envoyé',
    description: 'Envoyé quand le virement USDT ou Binance ID est finalisé.',
    category: 'withdrawals',
    multiline: true
  },
  {
    key: 'withdrawal_rejected',
    label: 'Notification Retrait Rejeté',
    description: 'Envoyé si la demande est refusée avec restitution des fonds. Variable : {reason}',
    category: 'withdrawals',
    multiline: true,
    variables: ['{reason}']
  },

  // Wallet & Coordonnées
  {
    key: 'balance_title',
    label: 'Titre Consultation Solde',
    description: 'En-tête affiché lors de la consultation du solde.',
    category: 'wallet'
  },
  {
    key: 'wallet_info_saved',
    label: 'Coordonnées Enregistrées',
    description: 'Confirmation de sauvegarde de l\'adresse USDT ou Binance ID.',
    category: 'wallet'
  },
  {
    key: 'wallet_info_deleted',
    label: 'Coordonnées Supprimées',
    description: 'Confirmation de suppression du portefeuille.',
    category: 'wallet'
  },

  // Boutons du bot
  {
    key: 'btn_tasks',
    label: 'Bouton : Effectuer une Tâche',
    description: 'Texte du bouton principal de démarrage de tâche.',
    category: 'buttons'
  },
  {
    key: 'btn_withdraw',
    label: 'Bouton : Demander un Retrait',
    description: 'Texte du bouton de demande de retrait.',
    category: 'buttons'
  },
  {
    key: 'btn_support',
    label: 'Bouton : Contacter le Support',
    description: 'Texte du bouton d\'assistance.',
    category: 'buttons'
  },
  {
    key: 'btn_rules',
    label: 'Bouton : Consignes & Règles',
    description: 'Texte du bouton d\'aide et de consignes.',
    category: 'buttons'
  },
  {
    key: 'btn_cancel',
    label: 'Bouton : Annuler le Processus',
    description: 'Bouton d\'abandon d\'une tâche en cours.',
    category: 'buttons'
  },
  {
    key: 'btn_cookies',
    label: 'Bouton : Mode Cookies',
    description: 'Texte pour l\'option de soumission par cookies.',
    category: 'buttons'
  },
  {
    key: 'btn_send_uid',
    label: 'Bouton : Envoyer l\'UID',
    description: 'Bouton d\'invite pour l\'étape UID.',
    category: 'buttons'
  }
];

export const BotMessagesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SupportedTab>('fr');
  const [messages, setMessages] = useState<BotMessagesConfig | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewKey, setPreviewKey] = useState<string>('welcome');

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await fetchBotMessagesApi();
      if (data) {
        setMessages(data);
      }
    } catch (err: any) {
      console.error('Failed to load bot messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const handleTextChange = (key: string, value: string) => {
    if (!messages) return;
    setMessages({
      ...messages,
      [activeTab]: {
        ...messages[activeTab],
        [key]: value
      }
    });
  };

  const handleSave = async () => {
    if (!messages) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await saveBotMessagesApi(messages);
      if (res.success) {
        setStatus({ type: 'success', text: 'Messages du bot sauvegardés et immédiatement synchronisés !' });
      } else {
        setStatus({ type: 'error', text: res.message || 'Erreur de sauvegarde' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Voulez-vous réinitialiser tous les messages personnalisés vers les modèles d’origine en français, anglais et malgache ?')) {
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await resetBotMessagesApi();
      if (res.success && res.messages) {
        setMessages(res.messages);
        setStatus({ type: 'success', text: 'Messages réinitialisés avec succès aux valeurs d’usine.' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const currentTabMessages = messages ? messages[activeTab] || {} : {};

  const filteredFields = MESSAGE_DEFINITIONS.filter(def => {
    if (activeCategory === 'all') return true;
    return def.category === activeCategory;
  });

  const activePreviewText = currentTabMessages[previewKey] || '';

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Gestion des Messages du Bot Telegram</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono text-emerald-400 font-bold">
                100% Dynamique
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Personnalisez l’intégralité des textes, notifications et boutons envoyés par <strong className="text-indigo-300">@TaskifyProBot</strong>.
              La langue sélectionnée par le travailleur détermine automatiquement les textes distribués.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={saving || loading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Restaurer les valeurs d'origine"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Sauvegarde...' : 'Enregistrer tout'}</span>
            </button>
          </div>
        </div>

        {status && (
          <div className={`mt-4 p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            status.type === 'success' 
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200' 
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-200'
          }`}>
            {status.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
            <span>{status.text}</span>
          </div>
        )}

        {/* Language Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('fr')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'fr'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span className="text-base">🇫🇷</span>
              <span>Français (fr)</span>
            </button>

            <button
              onClick={() => setActiveTab('en')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'en'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span className="text-base">🇬🇧</span>
              <span>English (en)</span>
            </button>

            <button
              onClick={() => setActiveTab('mg')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'mg'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span className="text-base">🇲🇬</span>
              <span>Malagasy (mg)</span>
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {[
              { id: 'all', label: 'Tous' },
              { id: 'welcome', label: 'Accueil' },
              { id: 'tasks', label: 'Tâches' },
              { id: 'verification', label: 'Vérification' },
              { id: 'withdrawals', label: 'Retraits' },
              { id: 'wallet', label: 'Portefeuille' },
              { id: 'buttons', label: 'Boutons' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Editor & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Fields List (Left column) */}
        <div className="lg:col-span-7 space-y-4">
          {filteredFields.map((field) => {
            const val = currentTabMessages[field.key] || '';
            const isSelected = previewKey === field.key;

            return (
              <div
                key={field.key}
                onClick={() => setPreviewKey(field.key)}
                className={`bg-slate-900/70 border rounded-2xl p-4 transition-all cursor-pointer ${
                  isSelected 
                    ? 'border-indigo-500 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-500/10' 
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <label className="text-xs font-bold text-white block">
                      {field.label}
                    </label>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {field.description}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {field.key}
                  </span>
                </div>

                {field.variables && field.variables.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] text-slate-500">Variables dynamiques :</span>
                    {field.variables.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTextChange(field.key, val + ' ' + v);
                        }}
                        className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] hover:bg-indigo-500/30 border border-indigo-500/30"
                        title="Cliquer pour insérer"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}

                {field.multiline ? (
                  <textarea
                    rows={4}
                    value={val}
                    onChange={(e) => handleTextChange(field.key, e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono leading-relaxed"
                  />
                ) : (
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => handleTextChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Live Telegram Preview (Right column sticky) */}
        <div className="lg:col-span-5">
          <div className="sticky top-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Aperçu Telegram Direct
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  Langue: <strong className="text-white uppercase">{activeTab}</strong>
                </span>
              </div>

              {/* Telegram Phone Simulator Shell */}
              <div className="bg-[#17212b] rounded-2xl p-4 border border-[#232e3c] space-y-3">
                {/* Bot Profile bar */}
                <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow">
                    TP
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      <span>Taskify Pro</span>
                      <span className="text-[9px] px-1 rounded bg-blue-500/30 text-blue-300">BOT</span>
                    </div>
                    <span className="text-[10px] text-slate-400">@TaskifyProBot</span>
                  </div>
                </div>

                {/* Message bubble */}
                <div className="bg-[#2b5278] text-white rounded-2xl rounded-tl-sm p-3 text-xs leading-relaxed shadow max-w-[95%] space-y-1">
                  <div className="whitespace-pre-wrap font-sans text-xs">
                    {activePreviewText || 'Sélectionnez un champ à gauche pour visualiser son rendu.'}
                  </div>
                  <div className="text-[9px] text-blue-200/60 text-right flex items-center justify-end gap-1">
                    <span>12:00</span>
                    <span>✓✓</span>
                  </div>
                </div>

                {/* Simulated Keyboard actions */}
                <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-1.5">
                  <div className="p-2 rounded-xl bg-[#232e3c] text-[11px] text-slate-200 text-center font-medium">
                    {currentTabMessages.btn_tasks || '📋 Effectuer une Tâche'}
                  </div>
                  <div className="p-2 rounded-xl bg-[#232e3c] text-[11px] text-slate-200 text-center font-medium">
                    {currentTabMessages.btn_withdraw || '🏦 Retrait'}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="text-slate-300 font-semibold block">Formatage Telegram Markdown supporté :</span>
                <p>• <code className="text-indigo-300 font-mono">*gras*</code> pour mettre en valeur</p>
                <p>• <code className="text-indigo-300 font-mono">`code`</code> pour les montants et identifiants</p>
                <p>• <code className="text-indigo-300 font-mono">{'{reward}'}</code> ou <code className="text-indigo-300 font-mono">{'{balance}'}</code> pour les valeurs calculées</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
