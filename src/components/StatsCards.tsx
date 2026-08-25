import React from 'react';
import { 
  Users, 
  CheckCircle2, 
  AlertOctagon, 
  KeyRound, 
  FileSpreadsheet,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';
import { TaskRecord, BotSettings } from '../types';

interface StatsCardsProps {
  tasks: TaskRecord[];
  settings: BotSettings;
  onFilterStatus: (status: string) => void;
  selectedFilter: string;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  tasks,
  settings,
  onFilterStatus,
  selectedFilter
}) => {
  const totalTasks = tasks.length;
  const createdTasks = tasks.filter(t => t.status === 'compte créé').length;
  const suspendedTasks = tasks.filter(t => t.status === 'compte suspendu').length;
  const verifiedTasks = tasks.filter(t => t.status === 'vérifié').length;
  const activeRate = totalTasks > 0 ? Math.round(((createdTasks + verifiedTasks) / totalTasks) * 100) : 100;
  const syncedCount = tasks.filter(t => t.syncedToGoogleSheets).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Tâches */}
      <div 
        onClick={() => onFilterStatus('all')}
        className={`p-5 rounded-2xl glass-card glass-card-hover transition-all cursor-pointer relative overflow-hidden group ${
          selectedFilter === 'all' 
            ? 'ring-2 ring-indigo-500 bg-indigo-950/30 border-indigo-500/50 shadow-lg shadow-indigo-500/10' 
            : 'hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-sans">Total Tâches</span>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl font-extrabold text-white font-mono">{totalTasks}</span>
          <span className="text-xs text-emerald-400 flex items-center font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <ArrowUpRight className="h-3 w-3 mr-0.5" /> 100% Free
          </span>
        </div>
        <div className="mt-3.5 text-xs text-slate-400 flex items-center justify-between pt-2.5 border-t border-slate-800/80">
          <span className="text-slate-400">Plateforme Cible</span>
          <span className="text-indigo-300 font-semibold font-mono text-[11px]">Facebook Pilot</span>
        </div>
      </div>

      {/* 2. Comptes Créés (Actifs) */}
      <div 
        onClick={() => onFilterStatus('compte créé')}
        className={`p-5 rounded-2xl glass-card glass-card-hover transition-all cursor-pointer relative overflow-hidden group ${
          selectedFilter === 'compte créé' 
            ? 'ring-2 ring-emerald-500 bg-emerald-950/30 border-emerald-500/50 shadow-lg shadow-emerald-500/10' 
            : 'hover:border-emerald-500/40'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-sans">Comptes Créés</span>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl font-extrabold text-emerald-400 font-mono">{createdTasks}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
            {activeRate}% succès
          </span>
        </div>
        <div className="mt-3.5 text-xs text-slate-400 flex items-center justify-between pt-2.5 border-t border-slate-800/80">
          <span className="text-slate-400">UID & Cookies</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Opérationnels
          </span>
        </div>
      </div>

      {/* 3. Comptes Suspendus (Alertes) */}
      <div 
        onClick={() => onFilterStatus('compte suspendu')}
        className={`p-5 rounded-2xl glass-card glass-card-hover transition-all cursor-pointer relative overflow-hidden group ${
          selectedFilter === 'compte suspendu' 
            ? 'ring-2 ring-rose-500 bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-500/10' 
            : 'hover:border-rose-500/40'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-400 font-sans">Comptes Suspendus</span>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform">
            <AlertOctagon className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl font-extrabold text-rose-400 font-mono">{suspendedTasks}</span>
          {suspendedTasks > 0 ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 animate-pulse">
              À traiter
            </span>
          ) : (
            <span className="text-xs text-slate-400">0 alerte</span>
          )}
        </div>
        <div className="mt-3.5 text-xs text-slate-400 flex items-center justify-between pt-2.5 border-t border-slate-800/80">
          <span className="text-slate-400">Suivi des blocages</span>
          <span className="text-rose-300 font-semibold font-mono text-[11px]">{suspendedTasks} signalement{suspendedTasks > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* 4. Mot de Passe Bot & Synchronisation */}
      <div className="p-5 rounded-2xl glass-card relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-sans">Mot de Passe Dynamique</span>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <KeyRound className="h-4 w-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold font-mono text-indigo-200 truncate max-w-[190px] bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800" title={settings.customPassword}>
            {settings.customPassword}
          </span>
        </div>
        <div className="mt-3.5 text-xs text-slate-400 flex items-center justify-between pt-2.5 border-t border-slate-800/80">
          <span className="flex items-center gap-1.5 text-slate-400">
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            Sheets Sync
          </span>
          <span className={`font-semibold font-mono text-xs ${syncedCount === totalTasks && totalTasks > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {syncedCount}/{totalTasks}
          </span>
        </div>
      </div>
    </div>
  );
};
