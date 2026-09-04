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
  onRejectTask?: (taskId: string, reason?: string) => Promise<void>;
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
  onRejectTask,
  onBotCheckTask
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyTasks, setBusyTasks] = useState<Record<string, boolean>>({});
  const [rejectModalTaskId, setRejectModalTaskId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('UID Facebook non accessible / Vérification échouée');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTasks = tasks.filter(task => {
    let matchesFilter = true;
    if (selectedFilter === 'all') {
      matchesFilter = true;
    } else if (selectedFilter === 'pending_verification' || selectedFilter === 'pending') {
      matchesFilter = task.accountStatus === 'pending_verification' || (!task.accountStatus && (task.status === 'compte créé' || task.status === 'en attente'));
    } else if (selectedFilter === 'verified') {
      matchesFilter = task.accountStatus === 'verified' || task.status === 'vérifié';
    } else if (selectedFilter === 'suspended') {
      matchesFilter = task.accountStatus === 'suspended' || task.status === 'compte suspendu';
    } else if (selectedFilter === 'bot_verified') {
      matchesFilter = (task.verificationMethod === 'BOT' || task.verificationMethod === 'bot') &&
        (task.accountStatus === 'verified' || task.verificationResult === 'GREEN' || task.validationStatus === 'validated');
    } else if (selectedFilter === 'bot_rejected') {
      matchesFilter = (task.verificationMethod === 'BOT' || task.verificationMethod === 'bot') &&
        (task.accountStatus === 'suspended' || task.verificationResult === 'RED' || task.validationStatus === 'rejected');
    } else if (selectedFilter === 'admin_verified') {
      matchesFilter = (task.verificationMethod === 'ADMIN' || task.verificationMethod === 'MANUAL' || task.verificationMethod === 'admin_dashboard') &&
        (task.accountStatus === 'verified' || task.validationStatus === 'validated');
    } else if (selectedFilter === 'admin_rejected') {
      matchesFilter = (task.verificationMethod === 'ADMIN' || task.verificationMethod === 'MANUAL' || task.verificationMethod === 'admin_dashboard') &&
        (task.accountStatus === 'suspended' || task.validationStatus === 'rejected');
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
      (task.verificationMethod && task.verificationMethod.toLowerCase().includes(q)) ||
      (task.validationReason && task.validationReason.toLowerCase().includes(q)) ||
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
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs flex-wrap gap-1">
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
                selectedFilter === 'pending_verification' || selectedFilter === 'pending' ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
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

            {/* Specialized Verification Filters */}
            <button
              onClick={() => onFilterChange('bot_verified')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                selectedFilter === 'bot_verified' ? 'bg-teal-600/30 text-teal-300 border border-teal-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vérifiés automatiquement par le Bot (GREEN)"
            >
              🤖 Bot Vérifié ({tasks.filter(t => (t.verificationMethod === 'BOT' || t.verificationMethod === 'bot') && (t.accountStatus === 'verified' || t.verificationResult === 'GREEN' || t.validationStatus === 'validated')).length})
            </button>
            <button
              onClick={() => onFilterChange('bot_rejected')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                selectedFilter === 'bot_rejected' ? 'bg-rose-600/30 text-rose-300 border border-rose-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Rejetés automatiquement par le Bot (RED)"
            >
              🤖 Bot Rejeté ({tasks.filter(t => (t.verificationMethod === 'BOT' || t.verificationMethod === 'bot') && (t.accountStatus === 'suspended' || t.verificationResult === 'RED' || t.validationStatus === 'rejected')).length})
            </button>
            <button
              onClick={() => onFilterChange('admin_verified')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                selectedFilter === 'admin_verified' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Validés manuellement par un Admin"
            >
              👤 Admin Vérifié ({tasks.filter(t => (t.verificationMethod === 'ADMIN' || t.verificationMethod === 'MANUAL' || t.verificationMethod === 'admin_dashboard') && (t.accountStatus === 'verified' || t.validationStatus === 'validated')).length})
            </button>
            <button
              onClick={() => onFilterChange('admin_rejected')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                selectedFilter === 'admin_rejected' ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Rejetés manuellement par un Admin"
            >
              👤 Admin Rejeté ({tasks.filter(t => (t.verificationMethod === 'ADMIN' || t.verificationMethod === 'MANUAL' || t.verificationMethod === 'admin_dashboard') && (t.accountStatus === 'suspended' || t.validationStatus === 'rejected')).length})
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
              <th className="py-4 px-3 sm:px-4">Date & ID</th>
              <th className="py-4 px-3 sm:px-4">UID Facebook</th>
              <th className="py-4 px-3 sm:px-4">Identité</th>
              <th className="py-4 px-3 sm:px-4">Cookies</th>
              <th className="py-4 px-3 sm:px-4">Opérateur Telegram</th>
              <th className="py-4 px-3 sm:px-4 text-center">Statut Compte</th>
              <th className="py-4 px-3 sm:px-4 text-center">Méthode</th>
              <th className="py-4 px-3 sm:px-4 text-center">Résultat</th>
              <th className="py-4 px-3 sm:px-4">Motif</th>
              <th className="py-4 px-3 sm:px-4 text-center">Rémunération</th>
              <th className="py-4 px-3 sm:px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-20 text-center">
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
                const isSuspended = task.accountStatus === 'suspended' || task.status === 'compte suspendu';
                const isVerified = task.accountStatus === 'verified' || task.status === 'vérifié';
                return (
                  <tr 
                    key={task.id} 
                    className={`hover:bg-slate-800/40 transition-colors group ${
                      isSuspended ? 'bg-rose-950/15 border-l-4 border-l-rose-500' : isVerified ? 'border-l-4 border-l-emerald-500/60' : ''
                    }`}
                  >
                    {/* 1. Date & Time */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <div className="font-mono text-slate-300 font-semibold text-xs">
                        {new Date(task.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(task.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {task.syncedToGoogleSheets && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-mono font-bold mt-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Synchronisé avec Google Sheets">
                          <FileSpreadsheet className="h-2.5 w-2.5" /> Sheets OK
                        </span>
                      )}
                    </td>

                    {/* 2. UID Facebook */}
                    <td className="py-3 px-3 sm:px-4 font-mono whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white tracking-wide select-all bg-slate-950/90 px-2 py-1 rounded-lg border border-slate-800 text-xs">
                          {task.uid}
                        </span>
                        <button
                          onClick={() => handleCopy(task.uid, `uid-${task.id}`)}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                          title="Copier l'UID"
                        >
                          {copiedId === `uid-${task.id}` ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* 3. Generated Identity */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                          {task.firstName.charAt(0)}{task.lastName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200 text-xs">
                            {task.firstName} {task.lastName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <KeyRound className="h-2 w-2 text-indigo-400" />
                            <span>{task.password}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 4. Cookies */}
                    <td className="py-3 px-3 sm:px-4 max-w-[140px]">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[10px] text-slate-300 truncate bg-slate-950/90 px-2 py-1 rounded-md border border-slate-800 max-w-[100px]" title={task.cookies}>
                          {task.cookies ? `${task.cookies.substring(0, 16)}...` : 'Vide'}
                        </span>
                        <button
                          onClick={() => handleCopy(task.cookies, `cookie-${task.id}`)}
                          className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all flex-shrink-0"
                          title="Copier tous les cookies"
                        >
                          {copiedId === `cookie-${task.id}` ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* 5. Telegram User */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-200 text-xs">
                        @{task.telegramUsername || 'anonyme'}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        ID: {task.telegramUserId}
                      </div>
                    </td>

                    {/* 6. Account Status */}
                    <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                      {getAccountStatusBadge(task)}
                    </td>

                    {/* 7. Verification Method */}
                    <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        task.verificationMethod === 'BOT' || task.verificationMethod === 'bot'
                          ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          : task.verificationMethod === 'ADMIN' || task.verificationMethod === 'MANUAL' || task.verificationMethod === 'admin_dashboard'
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {task.verificationMethod || 'NON DÉFINIE'}
                      </span>
                    </td>

                    {/* 8. Verification Result */}
                    <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        task.verificationResult === 'GREEN' || task.validationStatus === 'validated' || task.accountStatus === 'verified'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : task.verificationResult === 'RED' || task.validationStatus === 'rejected' || task.accountStatus === 'suspended'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>
                        {task.verificationResult || (isVerified ? 'GREEN' : isSuspended ? 'RED' : 'PENDING')}
                      </span>
                    </td>

                    {/* 9. Validation Reason */}
                    <td className="py-3 px-3 sm:px-4 max-w-[180px]">
                      <div className="truncate text-[11px] text-slate-300 font-sans" title={task.validationReason || task.notes || 'Aucun motif'}>
                        {task.validationReason || task.notes || <span className="text-slate-600 font-mono">—</span>}
                      </div>
                    </td>

                    {/* 10. Reward & Task Status */}
                    <td className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`font-mono font-bold text-xs ${
                          task.validationStatus === 'validated' || task.rewardPaid ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {task.validationStatus === 'validated' || task.rewardPaid ? '+$0.040 USD' : '$0.00 USD'}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {task.validationStatus === 'validated' ? 'VALIDATED' : task.validationStatus === 'rejected' ? 'REJECTED' : 'PENDING'}
                        </span>
                      </div>
                    </td>

                    {/* 11. Action Buttons */}
                    <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
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
                            className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all shadow-sm disabled:opacity-50"
                            title="Lancer le Bot Check automatique (UID Checker API)"
                          >
                            <ShieldCheck className={`h-3.5 w-3.5 ${busyTasks[task.id] ? 'animate-spin' : ''}`} />
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
                            className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all shadow-sm disabled:opacity-50"
                            title="Valider le compte (Statut: VERIFIED, Rémunération: +$0.04)"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Quick Reject */}
                        {onRejectTask && task.accountStatus !== 'suspended' && (
                          <button
                            onClick={() => {
                              setRejectModalTaskId(task.id);
                              setRejectReasonInput('UID Facebook non accessible / Vérification échouée');
                            }}
                            className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-all shadow-sm"
                            title="Rejeter et Suspendre le compte (Statut: SUSPENDED, 0$)"
                          >
                            <AlertOctagon className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onSelectTask(task)}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all shadow-sm"
                          title="Voir les détails complets"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Êtes-vous sûr de vouloir supprimer la tâche ${task.uid} ?`)) {
                              onDeleteTask(task.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 transition-all shadow-sm"
                          title="Supprimer la tâche"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Admin Quick Reject Modal */}
      {rejectModalTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="glass-card border border-rose-500/30 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-5 bg-slate-900/95 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertOctagon className="h-5 w-5" />
              <h4 className="text-sm font-bold text-white">Rejeter et Suspendre le Compte</h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Le statut du compte passera à <strong className="text-rose-400">SUSPENDED</strong>, la tâche à <strong className="text-rose-400">REJECTED</strong>, et aucune rémunération ne sera versée.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase font-bold">Sélectionner un motif prédéfini :</label>
              <div className="grid grid-cols-1 gap-1 text-xs">
                {[
                  'UID Facebook non accessible / Vérification échouée',
                  'Compte Facebook désactivé ou suspendu',
                  'Cookies Facebook expirés ou invalides',
                  'Identité ou mot de passe non conforme',
                  'Doublon ou compte déjà enregistré'
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReasonInput(reason)}
                    className={`text-left px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                      rejectReasonInput === reason
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    • {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400 uppercase font-bold">Ou saisir un motif personnalisé :</label>
              <textarea
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                rows={2}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                placeholder="Précisez la raison du rejet..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalTaskId(null)}
                disabled={isRejecting}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={isRejecting || !rejectReasonInput.trim()}
                onClick={async () => {
                  if (!onRejectTask || !rejectModalTaskId) return;
                  setIsRejecting(true);
                  try {
                    await onRejectTask(rejectModalTaskId, rejectReasonInput.trim());
                    setRejectModalTaskId(null);
                  } finally {
                    setIsRejecting(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/30 disabled:opacity-50"
              >
                {isRejecting ? 'Rejet en cours...' : 'Confirmer Rejet & Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

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

