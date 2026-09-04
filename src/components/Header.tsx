import React from 'react';
import { 
  Bot, 
  ShieldCheck, 
  RefreshCw, 
  Plus, 
  FileSpreadsheet, 
  BookOpen, 
  Settings, 
  Terminal, 
  Activity,
  Download,
  AlertTriangle,
  DollarSign,
  Users
} from 'lucide-react';
import { BotSettings, TaskRecord } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: BotSettings;
  tasks: TaskRecord[];
  onRefresh: () => void;
  onOpenCreate: () => void;
  onOpenExport: () => void;
  onSyncSheets: () => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  tasks,
  onRefresh,
  onOpenCreate,
  onOpenExport,
  onSyncSheets,
  isSyncing
}) => {
  const suspendedCount = tasks.filter(t => t.status === 'compte suspendu').length;

  const navItems = [
    { id: 'tasks', label: 'Tâches & Comptes', icon: Activity, badge: tasks.length },
    { id: 'withdrawals', label: 'Retraits & Finances', icon: DollarSign, highlight: true },
    { id: 'simulator', label: 'Simulateur Bot', icon: Bot },
    { id: 'analytics', label: 'Analytiques', icon: ShieldCheck },
    { id: 'staff', label: 'Équipe & Rôles', icon: Users },
    { id: 'settings', label: 'Paramètres Bot', icon: Settings },
    { id: 'google-sheets', label: 'Google Sheets API', icon: FileSpreadsheet },
    { id: 'tutorial', label: 'Déploiement 0€', icon: BookOpen },
    { id: 'logs', label: 'Logs en direct', icon: Terminal }
  ];

  return (
    <header className="bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-700 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20 shrink-0">
              <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white font-sans">
                  Taskify <span className="text-indigo-400">Pro</span>
                </span>
                <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  @TaskifyProBot
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:flex items-center gap-2">
                <span>Hub Automatisé de Supervision Telegram</span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-indicator"></span> Live Polling
                </span>
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {suspendedCount > 0 && (
              <button 
                onClick={() => setActiveTab('tasks')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold hover:bg-rose-500/25 transition-all shadow-sm"
                title={`${suspendedCount} compte(s) suspendu(s) nécessitant une attention`}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                <span className="hidden sm:inline">Suspendus :</span>
                <span className="font-bold text-rose-200">{suspendedCount}</span>
              </button>
            )}

            <button
              onClick={onSyncSheets}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                settings.googleSheetWebhookUrl 
                  ? 'bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 border border-slate-700/80'
              }`}
              title={settings.googleSheetWebhookUrl ? 'Synchroniser avec Google Sheets' : 'Configurer l\'URL Google Sheets'}
            >
              <FileSpreadsheet className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
              <span className="hidden md:inline">Sync Sheets</span>
            </button>

            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-all shadow-sm"
              title="Exporter les fichiers du bot autonome"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden lg:inline">Code Autonome</span>
            </button>

            <button
              onClick={onOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nouvelle Tâche</span>
            </button>

            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/80 transition-all shadow-sm"
              title="Actualiser les données"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-slate-950/70 border-t border-slate-800/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  } ${item.highlight && !isActive ? 'ring-1 ring-indigo-500/30 text-indigo-300 bg-indigo-950/20' : ''}`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : item.highlight ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};

