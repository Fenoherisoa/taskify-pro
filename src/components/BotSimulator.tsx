import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  KeyRound, 
  Smartphone,
  Copy,
  Check,
  Zap,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BotSettings, TaskRecord } from '../types';
import { simulateBotStep } from '../services/apiService';

interface BotSimulatorProps {
  settings: BotSettings;
  onNewTaskCreated: (task: TaskRecord) => void;
  onRefreshTasks: () => void;
}

interface MessageItem {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  buttons?: {
    text: string;
    action: string;
    variant?: 'primary' | 'secondary' | 'danger';
  }[][];
}

export const BotSimulator: React.FC<BotSimulatorProps> = ({
  settings,
  onNewTaskCreated,
  onRefreshTasks
}) => {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentStep, setCurrentStep] = useState<string>('START');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial bot startup message
  const initSimulator = async () => {
    setIsLoading(true);
    try {
      const data = await simulateBotStep('sim-client', 'START', undefined, settings);
      setCurrentStep(data.step);
      setMessages([
        {
          id: 'msg-start',
          sender: 'bot',
          text: data.message,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          buttons: data.buttons
        }
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initSimulator();
  }, []);

  const handleAction = async (action: string, customInput?: string) => {
    setIsLoading(true);

    if (customInput) {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: customInput,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }

    try {
      const data = await simulateBotStep('sim-client', action, customInput, settings);

      setCurrentStep(data.step);

      if (data.createdTask) {
        onNewTaskCreated(data.createdTask);
      }

      if (data.message.includes('Tâche terminée') || data.step === 'COMPLETED') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        onRefreshTasks();
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: data.message,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          buttons: data.buttons
        }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    const lower = text.toLowerCase();
    setInputText('');

    // High priority check for persistent menu navigation
    if (text.includes('Solde') || lower === 'solde' || lower === '/solde' || lower === '/balance') {
      handleAction('MENU_BALANCE', text);
    } else if (
      text.includes('Tâches') ||
      text.includes('Taches') ||
      text.includes('Démarrer tâche') ||
      lower === 'taches' ||
      lower === 'tâches' ||
      lower === '/tasks' ||
      lower === '/taches'
    ) {
      handleAction('CHOOSE_FACEBOOK', text);
    } else if (text.includes('Retrait') || lower === 'retrait' || lower === '/withdraw') {
      handleAction('MENU_WITHDRAW', text);
    } else if (text.includes('Support') || text.includes('Assistance') || lower === 'support' || lower === '/support') {
      handleAction('MENU_SUPPORT', text);
    } else if (text.includes('Parrainage') || text.includes('Parrainages') || lower === 'parrainage' || lower === '/referral') {
      handleAction('MENU_REFERRAL', text);
    } else if (text.includes('Classement') || lower === 'classement' || lower === '/leaderboard' || lower === '/top') {
      handleAction('MENU_LEADERBOARD', text);
    } else if (text.includes('Langue') || text.includes('Langues') || lower === 'langue' || lower === 'language' || lower === '/language') {
      handleAction('MENU_LANGUAGE', text);
    } else if (currentStep === 'AWAITING_UID') {
      handleAction('SEND_UID_TEXT', text);
    } else if (currentStep === 'AWAITING_COOKIES') {
      handleAction('SEND_COOKIES_TEXT', text);
    } else {
      handleAction('USER_TEXT', text);
    }
  };

  const handleQuickPasteSample = (type: 'uid' | 'cookies') => {
    if (type === 'uid') {
      const randomUid = '1000' + Math.floor(10000000000 + Math.random() * 90000000000);
      setInputText(randomUid);
    } else {
      setInputText('datr=' + Math.random().toString(36).substring(2) + '; c_user=100084928172910; xs=29%3A7a1b...; fr=0p9b...');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Info Panel: Bot Flow Specifications */}
      <div className="lg:col-span-5 space-y-4">
        <div className="p-6 rounded-2xl glass-card border border-slate-800/80 shadow-2xl">
          <div className="flex items-center gap-3.5 mb-5">
            <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base font-sans">Spécifications du Bot Telegram</h3>
              <p className="text-xs text-slate-400">Flux d'interaction conforme aux règles métier</p>
            </div>
          </div>

          {/* Workflow Steps Indicator */}
          <div className="space-y-3 text-xs">
            <div className={`p-3.5 rounded-xl border transition-all ${
              currentStep === 'START' || currentStep === 'TASK_SELECTED' 
                ? 'bg-indigo-950/40 border-indigo-500/60 text-indigo-200 ring-1 ring-indigo-500/30' 
                : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
            }`}>
              <div className="font-bold text-slate-200 flex items-center justify-between mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                  Démarrage & Choix Tâche
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">/start</span>
              </div>
              <p className="text-slate-400 text-[11px] mt-1.5 pl-7">
                Affiche les tâches disponibles avec le module pilote prioritaire <strong>"Facebook"</strong>.
              </p>
            </div>

            <div className={`p-3.5 rounded-xl border transition-all ${
              currentStep === 'AUTH_CHOICE' || currentStep === '2FA_NOTICE'
                ? 'bg-indigo-950/40 border-indigo-500/60 text-indigo-200 ring-1 ring-indigo-500/30' 
                : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
            }`}>
              <div className="font-bold text-slate-200 flex items-center justify-between mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                  Méthode : Cookies vs 2FA
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">Cookies / 2FA</span>
              </div>
              <p className="text-slate-400 text-[11px] mt-1.5 pl-7">
                L'utilisateur sélectionne <em>Cookies</em>. Le bouton <em>2FA</em> affiche une alerte préventive et annule la saisie.
              </p>
            </div>

            <div className={`p-3.5 rounded-xl border transition-all ${
              currentStep === 'CREDENTIALS_SHOWN'
                ? 'bg-indigo-950/40 border-indigo-500/60 text-indigo-200 ring-1 ring-indigo-500/30' 
                : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
            }`}>
              <div className="font-bold text-slate-200 flex items-center justify-between mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
                  Génération Identité & Password
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 font-bold">Auto-Gen</span>
              </div>
              <p className="text-slate-400 text-[11px] mt-1.5 pl-7">
                Génération automatique du Prénom & Nom, avec fourniture du mot de passe dynamique modifiable :
                <span className="block mt-1.5 font-mono text-indigo-300 font-bold bg-slate-950/90 p-2 rounded-lg border border-slate-800">
                  🔑 {settings.customPassword}
                </span>
              </p>
            </div>

            <div className={`p-3.5 rounded-xl border transition-all ${
              currentStep === 'AWAITING_UID' || currentStep === 'AWAITING_COOKIES'
                ? 'bg-indigo-950/40 border-indigo-500/60 text-indigo-200 ring-1 ring-indigo-500/30' 
                : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
            }`}>
              <div className="font-bold text-slate-200 flex items-center justify-between mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">4</span>
                  Envoi UID & Cookies
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold">Envoie UID</span>
              </div>
              <p className="text-slate-400 text-[11px] mt-1.5 pl-7">
                Bouton de saisie guidée. L'utilisateur envoie son UID Facebook puis ses cookies complets.
              </p>
            </div>

            <div className={`p-3.5 rounded-xl border transition-all ${
              currentStep === 'COMPLETED'
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-500/30' 
                : 'bg-slate-950/50 border-slate-800/80 text-slate-400'
            }`}>
              <div className="font-bold text-slate-200 flex items-center justify-between mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">5</span>
                  Clôture & Synchronisation
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold">Tâche terminée</span>
              </div>
              <p className="text-slate-400 text-[11px] mt-1.5 pl-7">
                Validation immédiate, enregistrement dans le tableau de bord et transmission instantanée à Google Sheets.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Simulator Utilities */}
        <div className="p-4 sm:p-5 rounded-2xl glass-card border border-slate-800/80 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-wider text-slate-400 text-[11px] block font-mono">
              Outils de Test Rapide
            </span>
            <span className="text-[10px] text-indigo-400 font-mono">Saisie directe ou modèle</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => handleQuickPasteSample('uid')}
              className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-mono font-semibold transition-all text-center border border-slate-700/80 shadow-sm"
              title="Insérer un modèle d'UID Facebook à 15 chiffres"
            >
              + Format UID (15 car.)
            </button>
            <button
              onClick={() => handleQuickPasteSample('cookies')}
              className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-mono font-semibold transition-all text-center border border-slate-700/80 shadow-sm"
              title="Insérer un modèle de chaîne de cookies Facebook"
            >
              + Format Cookies
            </button>
          </div>
        </div>
      </div>

      {/* Right Phone Mockup Panel */}
      <div className="lg:col-span-7 flex justify-center">
        <div className="w-full max-w-md bg-slate-950 rounded-[32px] border-4 border-slate-800/90 shadow-2xl overflow-hidden flex flex-col h-[650px] relative ring-1 ring-white/10">
          {/* Telegram App Header Bar */}
          <div className="bg-slate-900/95 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between z-10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center text-white font-black text-xs shadow-md shadow-indigo-600/30 ring-1 ring-white/20">
                  BOT
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-slate-900"></span>
              </div>
              <div>
                <h4 className="font-extrabold text-white text-sm leading-tight font-sans">
                  {settings.platformName || 'Taskify Pro Bot'}
                </h4>
                <span className="text-[11px] text-indigo-400 font-mono font-medium">@TaskifyProBot</span>
              </div>
            </div>

            <button
              onClick={initSimulator}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
              title="Réinitialiser la conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-950 via-[#070b14] to-slate-950">
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl p-3.5 text-xs shadow-md space-y-2 ${
                      isBot
                        ? 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-sm backdrop-blur'
                        : 'bg-indigo-600 text-white rounded-tr-sm shadow-indigo-600/20'
                    }`}
                  >
                    {/* Text display */}
                    <div className="whitespace-pre-wrap leading-relaxed font-sans text-xs">
                      {msg.text.split('\n').map((line, i) => {
                        if (line.startsWith('👤') || line.startsWith('🔑') || line.startsWith('🆔')) {
                          return (
                            <div key={i} className="py-0.5 font-mono text-[11px] font-bold text-indigo-300 bg-slate-950/60 px-2 rounded mt-0.5 border border-indigo-500/20">
                              {line}
                            </div>
                          );
                        }
                        return <div key={i}>{line}</div>;
                      })}
                    </div>

                    <div
                      className={`text-[10px] text-right font-mono ${
                        isBot ? 'text-slate-500' : 'text-indigo-200'
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>

                  {/* Inline Action Buttons under Bot Messages */}
                  {isBot && msg.buttons && msg.buttons.length > 0 && (
                    <div className="w-full max-w-[88%] mt-2 space-y-1.5">
                      {msg.buttons.map((row, rIdx) => (
                        <div key={rIdx} className="grid grid-cols-1 gap-1.5">
                          {row.map((btn, bIdx) => {
                            let btnStyle = 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40 shadow-indigo-600/10';
                            if (btn.variant === 'danger') {
                              btnStyle = 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/40 shadow-rose-600/10';
                            } else if (btn.variant === 'secondary') {
                              btnStyle = 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/80';
                            }

                            return (
                              <button
                                key={bIdx}
                                onClick={() => handleAction(btn.action)}
                                disabled={isLoading}
                                className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold shadow transition-all active:scale-95 flex items-center justify-center gap-2 ${btnStyle}`}
                              >
                                <span>{btn.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 max-w-fit">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping"></span>
                <span>Le bot prépare sa réponse...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Persistent Telegram Reply Keyboard (Menu Principal) */}
          <div className="p-2.5 bg-slate-950/95 border-t border-slate-800/80">
            <div className="text-[10px] text-slate-500 font-mono mb-1.5 px-1 flex items-center justify-between">
              <span>Clavier Telegram Persistant (Menu Principal)</span>
              <span className="text-indigo-400">Interactif</span>
            </div>
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAction('MENU_BALANCE', '💰 Solde')}
                  disabled={isLoading}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-xs font-semibold active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  💰 Solde
                </button>
                <button
                  type="button"
                  onClick={() => handleAction('CHOOSE_FACEBOOK', '📋 Tâches')}
                  disabled={isLoading}
                  className="py-1.5 px-2.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/50 text-indigo-200 text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1 shadow-sm"
                >
                  📋 Tâches
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAction('MENU_WITHDRAW', '🏦 Retrait')}
                  disabled={isLoading}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 text-xs font-medium active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  🏦 Retrait
                </button>
                <button
                  type="button"
                  onClick={() => handleAction('MENU_SUPPORT', '📞 Support')}
                  disabled={isLoading}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 text-xs font-medium active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  📞 Support
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAction('MENU_REFERRAL', '👥 Parrainages')}
                  disabled={isLoading}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 text-xs font-medium active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  👥 Parrainages
                </button>
                <button
                  type="button"
                  onClick={() => handleAction('MENU_LEADERBOARD', '🏆 Classement')}
                  disabled={isLoading}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 text-xs font-medium active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  🏆 Classement
                </button>
              </div>

              <div className="grid grid-cols-1">
                <button
                  type="button"
                  onClick={() => handleAction('MENU_LANGUAGE', '🪩 Langue')}
                  disabled={isLoading}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 text-xs font-medium active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  🪩 Langue
                </button>
              </div>
            </div>
          </div>

          {/* Chat Input Field */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-slate-900/95 border-t border-slate-800/80 flex items-center gap-2 backdrop-blur"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                currentStep === 'AWAITING_UID'
                  ? 'Collez votre UID Facebook ici...'
                  : currentStep === 'AWAITING_COOKIES'
                  ? 'Collez vos Cookies Facebook ici...'
                  : 'Tapez un message ou cliquez sur un bouton...'
              }
              className="flex-1 px-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

