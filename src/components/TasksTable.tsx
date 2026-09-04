import React, { useState } from 'react';
import { 
  Search, 
  Copy, 
  Check, 
  Eye, 
  Trash2, 
  AlertOctagon, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Download, 
  KeyRound,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { TaskRecord, TaskStatus } from '../types';

interface TasksTableProps {
  tasks: TaskRecord[];
  onSelectTask: (task: TaskRecord) => void;
  onUpdateStatus: (taskId: string, newStatus: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
  selectedFilter: string;
  onFilterChange: (status: string) => void;
  onValidateTask?: (taskId: string) => Promise<void>;
  onBotCheckTask?: (taskId: string) => Promise<void>;
}

export const TasksTable: React.FC<TasksTableProps> = ({
  tasks,
  onSelectTask,
  onUpdateStatus,
  onDeleteTask,
  selectedFilter,
  onFilterChange,
  onValidateTask,
  onBotCheckTask
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyTasks, setBusyTasks] = useState<Record<string, boolean>>({});

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTasks = tasks.filter(task => {
    let matchesFilter = true;
    if (selectedFilter === 'all') {
      matchesFilter = true;
    } else if (selectedFilter === 'pending_verification') {
      matchesFilter = task.accountStatus === 'pending_verification' || (!task.accountStatus && (task.status === 'compte créé' || task.status === 'en attente'));
    } else if (selectedFilter === 'verified') {
      matchesFilter = task.accountStatus === 'verified' || task.status === 'vérifié';
    } else if (selectedFilter === 'suspended') {
      matchesFilter = task.accountStatus === 'suspended' || task.status === 'compte suspendu';
    } else {
      matchesFilter = task.status === selectedFilter;
    }

    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      task.uid.toLowerCase().includes(q) ||
      task.firstName.toLowerCase().includes(q) ||
      task.lastName.toLowerCase().includes(q) ||
      task.telegramUsername.toLowerCase().includes(q) ||
      task.telegramUserId.toLowerCase().includes(q) ||
      (task.notes && task.notes.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  const exportToCSV = () => {
    if (filteredTasks.length === 0) return;
    const headers = ['Date', 'ID', 'Statut', 'UID Facebook', 'Prenom', 'Nom', 'Mot de passe', 'Cookies', 'Telegram User', 'Notes'];
    const rows = filteredTasks.map(t => [
      `"${new Date(t.createdAt).toLocaleString('fr-FR')}"`,
      `"${t.id}"`,
      `"${t.status}"`,
      `"${t.uid}"`,
      `"${t.firstName}"`,
      `"${t.lastName}"`,
      `"${t.password}"`,
      `"${(t.cookies || '').replace(/"/g, '""')}"`,
      `"${t.telegramUsername} (${t.telegramUserId})"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Taskify_Pro_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getAccountStatusBadge = (task: TaskRecord) => {
    const isVerified = task.accountStatus === 'verified' || task.status === 'vérifié';
    const isSuspended = task.accountStatus === 'suspended' || task.status === 'compte suspendu';

    if (isVerified) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          Vérifié (Verified)
        </span>
      );
    }
    if (isSuspended) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
          <AlertOctagon className="h-3 w-3 text-rose-400" />
          Suspendu (Suspended)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <Clock className="h-3 w-3 text-amber-400" />
        En Attente (Pending)
      </span>
    );
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'compte créé':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            Tâche : Créée
          </span>
        );
      case 'compte suspendu':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            Tâche : Rejetée
          </span>
        );
      case 'vérifié':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            Tâche : Validée
          </span>
        );
      case 'en attente':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Tâche : En attente
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="glass-card rounded-2xl shadow-2xl overflow-hidden border border-slate-800/80">
      {/* Table Controls Header */}
      <div className="p-4 sm:p-6 border-b border-slate-800/80 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-900/40">
        {/* Search Field */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par UID, Nom, Prénom, Telegram..."
            className="w-full pl-10 pr-16 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-xs sm:text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded bg-slate-800"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Filter Pills & Export */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs flex-wrap">
            <button
              onClick={() => onFilterChange('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedFilter === 'all' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tous ({tasks.length})
            </button>
            <button
              onClick={() => onFilterChange('pending_verification')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedFilter === 'pending_verification' ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              En Attente ({tasks.filter(t => t.accountStatus === 'pending_verification' || (!t.accountStatus && t.status !== 'vérifié' && t.status !== 'compte suspendu')).length})
            </button>
            <button
              onClick={() => onFilterChange('verified')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedFilter === 'verified' ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Vérifiés ({tasks.filter(t => t.accountStatus === 'verified' || t.status === 'vérifié').length})
            </button>
            <button
              onClick={() => onFilterChange('suspended')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                selectedFilter === 'suspended' ? 'bg-rose-600/30 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Suspendus ({tasks.filter(t => t.accountStatus === 'suspended' || t.status === 'compte suspendu').length})
            </button>
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-all ml-auto shadow-sm"
            title="Télécharger la liste au format CSV"
          >
            <Download className="h-3.5 w-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/60 border-b border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              <th className="py-4 px-4 sm:px-6">Date & ID</th>
              <th className="py-4 px-4 sm:px-6">UID Facebook</th>
              <th className="py-4 px-4 sm:px-6">Identité Générée</th>
              <th className="py-4 px-4 sm:px-6">Cookies</th>
              <th className="py-4 px-4 sm:px-6">Utilisateur Telegram</th>
              <th className="py-4 px-4 sm:px-6 text-center">Statut (Gestion)</th>
              <th className="py-4 px-4 sm:px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-center">
                  <div className="max-w-md mx-auto flex flex-col items-center">
                    <div className="relative mb-4">
                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl text-indigo-400">
                        <FileSpreadsheet className="h-8 w-8" />
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                      </span>
                    </div>
                    <p className="font-bold text-base text-slate-200">En attente de réceptions de tâches</p>
                    <p className="text-xs text-slate-400 mt-1.5 max-w-sm leading-relaxed">
                      {searchQuery 
                        ? "Aucun enregistrement ne correspond aux critères de recherche." 
                        : "Le tableau est prêt. Les soumissions envoyées par les opérateurs via le bot Telegram ou le simulateur s'afficheront ici instantanément."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => {
                const isSuspended = task.status === 'compte suspendu';
                return (
                  <tr 
                    key={task.id} 
                    className={`hover:bg-slate-800/40 transition-colors group ${
                      isSuspended ? 'bg-rose-950/15 border-l-4 border-l-rose-500' : ''
                    }`}
                  >
                    {/* 1. Date & Time */}
                    <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                      <div className="font-mono text-slate-300 font-semibold">
                        {new Date(task.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {new Date(task.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {task.syncedToGoogleSheets && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-bold mt-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Synchronisé avec Google Sheets">
                          <FileSpreadsheet className="h-2.5 w-2.5" /> Sheets OK
                        </span>
                      )}
                      {task.validationStatus === 'validated' && (
                        <div className="inline-flex items-center gap-1 text-[10px] text-emerald-300 font-mono font-bold mt-1 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          ✓ Rémunéré ($0.04)
                        </div>
                      )}
                      {task.validationStatus === 'rejected' && (
                        <div className="inline-flex items-center gap-1 text-[10px] text-rose-300 font-mono font-bold mt-1 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/30">
                          ✗ Rejeté
                        </div>
                      )}
                    </td>

                    {/* 2. UID Facebook */}
                    <td className="py-4 px-4 sm:px-6 font-mono whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white tracking-wide select-all bg-slate-950/90 px-2.5 py-1.5 rounded-lg border border-slate-800">
                          {task.uid}
                        </span>
                        <button
                          onClick={() => handleCopy(task.uid, `uid-${task.id}`)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                          title="Copier l'UID"
                        >
                          {copiedId === `uid-${task.id}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* 3. Generated Identity */}
                    <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                          {task.firstName.charAt(0)}{task.lastName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200 text-sm">
                            {task.firstName} {task.lastName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <KeyRound className="h-2.5 w-2.5 text-indigo-400" />
                            <span>{task.password}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 4. Cookies */}
                    <td className="py-4 px-4 sm:px-6 max-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-slate-300 truncate bg-slate-950/90 px-2.5 py-1.5 rounded-lg border border-slate-800 max-w-[160px]" title={task.cookies}>
                          {task.cookies ? `${task.cookies.substring(0, 24)}...` : 'Vide'}
                        </span>
                        <button
                          onClick={() => handleCopy(task.cookies, `cookie-${task.id}`)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all flex-shrink-0"
                          title="Copier tous les cookies"
                        >
                          {copiedId === `cookie-${task.id}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* 5. Telegram User */}
                    <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                      <div className="font-medium text-slate-200">
                        @{task.telegramUsername || 'anonyme'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        ID: {task.telegramUserId}
                      </div>
                    </td>

                    {/* 6. Account Verification & Task Status */}
                    <td className="py-4 px-4 sm:px-6 text-center whitespace-nowrap">
                      <div className="inline-flex flex-col items-center gap-1.5">
                        {getAccountStatusBadge(task)}

                        {/* Verification Method & Result Pill */}
                        {task.verificationMethod && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            task.verificationResult === 'GREEN' || task.validationStatus === 'validated'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                          }`}>
                            {task.verificationMethod}: {task.verificationResult || (task.validationStatus === 'validated' ? 'GREEN' : 'RED')}
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          {getStatusBadge(task.status)}
                          {task.rewardPaid && (
                            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              +$0.04
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 7. Action Buttons */}
                    <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Bot Check */}
                        {onBotCheckTask && (
                          <button
                            onClick={async () => {
                              setBusyTasks(prev => ({ ...prev, [task.id]: true }));
                              try {
                                await onBotCheckTask(task.id);
                              } finally {
                                setBusyTasks(prev => ({ ...prev, [task.id]: false }));
                              }
                            }}
                            disabled={busyTasks[task.id]}
                            className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all shadow-sm disabled:opacity-50"
                            title="Lancer le Bot Check automatique"
                          >
                            <ShieldCheck className={`h-4 w-4 ${busyTasks[task.id] ? 'animate-spin' : ''}`} />
                          </button>
                        )}

                        {/* Quick Validate */}
                        {onValidateTask && task.accountStatus !== 'verified' && (
                          <button
                            onClick={async () => {
                              setBusyTasks(prev => ({ ...prev, [task.id]: true }));
                              try {
                                await onValidateTask(task.id);
                              } finally {
                                setBusyTasks(prev => ({ ...prev, [task.id]: false }));
                              }
                            }}
                            disabled={busyTasks[task.id]}
                            className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all shadow-sm disabled:opacity-50"
                            title="Valider le compte (+0.04$)"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => onSelectTask(task)}
                          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all shadow-sm"
                          title="Voir les détails complets"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Êtes-vous sûr de vouloir supprimer la tâche ${task.uid} ?`)) {
                              onDeleteTask(task.id);
                            }
                          }}
                          className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 transition-all shadow-sm"
                          title="Supprimer la tâche"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-4 sm:p-5 bg-slate-950/70 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div>
          Affichage de <span className="font-bold text-slate-200 font-mono">{filteredTasks.length}</span> sur <span className="font-bold text-slate-200 font-mono">{tasks.length}</span> tâches
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Créé ({tasks.filter(t => t.status === 'compte créé').length})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            Suspendu ({tasks.filter(t => t.status === 'compte suspendu').length})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            Vérifié ({tasks.filter(t => t.status === 'vérifié').length})
          </span>
        </div>
      </div>
    </div>
  );
};

