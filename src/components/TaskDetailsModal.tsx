import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Save, 
  AlertOctagon, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  KeyRound, 
  User, 
  Send,
  Calendar,
  FileCode,
  FileSpreadsheet
} from 'lucide-react';
import { TaskRecord, TaskStatus } from '../types';

interface TaskDetailsModalProps {
  task: TaskRecord | null;
  onClose: () => void;
  onUpdateTask: (taskId: string, updates: Partial<TaskRecord>) => void;
  onSyncSingle: (task: TaskRecord) => void;
  onValidateTask?: (taskId: string) => Promise<void>;
  onRejectTask?: (taskId: string, reason?: string) => Promise<void>;
  onBotCheckTask?: (taskId: string) => Promise<void>;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  onClose,
  onUpdateTask,
  onSyncSingle,
  onValidateTask,
  onRejectTask,
  onBotCheckTask
}) => {
  if (!task) return null;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notes, setNotes] = useState(task.notes || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [isSaved, setIsSaved] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isBotChecking, setIsBotChecking] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = () => {
    onUpdateTask(task.id, { notes, status });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const fullJsonExport = JSON.stringify({
    uid: task.uid,
    firstName: task.firstName,
    lastName: task.lastName,
    password: task.password,
    cookies: task.cookies,
    status: status,
    telegramUser: `@${task.telegramUsername} (${task.telegramUserId})`,
    createdAt: task.createdAt
  }, null, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-card border border-slate-800/80 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-black text-sm">
              {task.firstName.charAt(0)}{task.lastName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white font-sans">
                  Détails Tâche : <span className="font-mono text-indigo-400">{task.uid}</span>
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold border border-slate-700">
                  {task.taskType || 'Facebook'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Créé le {new Date(task.createdAt).toLocaleString('fr-FR')} par @{task.telegramUsername}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* 1. Account Verification & Financial Reward Card */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 font-mono block">
                  Workflow de Vérification du Compte
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Statut du compte distinct du statut de tâche opérationnel.
                </p>
              </div>

              {/* Account Status Badge */}
              <div>
                {task.accountStatus === 'verified' || task.status === 'vérifié' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Compte Vérifié (Verified)
                  </span>
                ) : task.accountStatus === 'suspended' || task.status === 'compte suspendu' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
                    Compte Suspendu (Suspended)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    En Attente de Vérification (Pending)
                  </span>
                )}
              </div>
            </div>

            {/* Verification Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Statut Tâche</span>
                <span className={`font-mono font-bold ${
                  task.validationStatus === 'validated' ? 'text-emerald-400' :
                  task.validationStatus === 'rejected' ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  {task.validationStatus === 'validated' ? 'VALIDATED' :
                   task.validationStatus === 'rejected' ? 'REJECTED' : 'PENDING'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Méthode</span>
                <span className="font-mono font-bold text-slate-200">
                  {task.verificationMethod || 'AUCUNE'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Résultat Check</span>
                <span className={`font-mono font-bold ${
                  task.verificationResult === 'GREEN' ? 'text-emerald-400' :
                  task.verificationResult === 'RED' ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {task.verificationResult || 'NON DÉFINI'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Rémunération</span>
                <span className={`font-mono font-bold ${task.rewardPaid ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {task.rewardPaid ? '+$0.040 USD Payé' : '$0.00 USD'}
                </span>
              </div>
            </div>

            {task.validationReason && (
              <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs text-rose-300">
                <span className="font-bold font-mono text-[10px] uppercase block text-rose-400">Motif de rejet / suspension :</span>
                {task.validationReason}
              </div>
            )}

            {/* Action Buttons: Admin Validation, Admin Rejection, Auto Bot Check */}
            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              {onValidateTask && (
                <button
                  onClick={async () => {
                    setIsValidating(true);
                    try {
                      await onValidateTask(task.id);
                    } finally {
                      setIsValidating(false);
                    }
                  }}
                  disabled={isValidating || task.accountStatus === 'verified'}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/25 disabled:opacity-40"
                  title="Accepter l'account : statut = VERIFIED, tâche = VALIDATED, rémunération créditée"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isValidating ? 'Validation...' : 'Valider Compte (+$0.04)'}</span>
                </button>
              )}

              {onRejectTask && (
                <button
                  onClick={() => setShowRejectInput(!showRejectInput)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all"
                  title="Rejeter l'account : statut = SUSPENDED, tâche = REJECTED, 0$"
                >
                  <AlertOctagon className="w-4 h-4" />
                  <span>Rejeter / Suspendre</span>
                </button>
              )}

              {onBotCheckTask && (
                <button
                  onClick={async () => {
                    setIsBotChecking(true);
                    try {
                      await onBotCheckTask(task.id);
                    } finally {
                      setIsBotChecking(false);
                    }
                  }}
                  disabled={isBotChecking}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all disabled:opacity-50"
                  title="Lancer l'interrogation automatique de l'API Facebook UID Checker"
                >
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>{isBotChecking ? 'Vérification UID...' : 'Bot Check Automatique'}</span>
                </button>
              )}

              <button
                onClick={() => onSyncSingle(task)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition-all ml-auto"
                title="Forcer l'envoi vers Google Sheets"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                <span>Sync Sheets</span>
              </button>
            </div>

            {showRejectInput && onRejectTask && (
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  placeholder="Motif du rejet / suspension (ex: UID Facebook invalide, compte bloqué...)"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
                <button
                  onClick={async () => {
                    await onRejectTask(task.id, rejectReason || 'Non conforme');
                    setShowRejectInput(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all"
                >
                  Confirmer Suspension
                </button>
              </div>
            )}
          </div>

          {/* Credentials Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/80">
              <span className="text-xs text-slate-400 block mb-1 font-mono">Prénom & Nom générés</span>
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-base">
                  {task.firstName} {task.lastName}
                </span>
                <button
                  onClick={() => handleCopy(`${task.firstName} ${task.lastName}`, 'name')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                  title="Copier le nom"
                >
                  {copiedKey === 'name' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/80">
              <span className="text-xs text-slate-400 block mb-1 font-mono">Mot de passe (Dynamique)</span>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-indigo-300 text-sm">
                  {task.password}
                </span>
                <button
                  onClick={() => handleCopy(task.password, 'password')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                  title="Copier le mot de passe"
                >
                  {copiedKey === 'password' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* UID Facebook */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                UID Facebook
              </label>
              <button
                onClick={() => handleCopy(task.uid, 'uid')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
              >
                {copiedKey === 'uid' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                Copier l'UID
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-sm text-emerald-400 select-all font-bold">
              {task.uid}
            </div>
          </div>

          {/* Cookies Box */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Cookies de Session Facebook
              </label>
              <button
                onClick={() => handleCopy(task.cookies, 'cookies')}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
              >
                {copiedKey === 'cookies' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                Copier les cookies complets
              </button>
            </div>
            <textarea
              readOnly
              value={task.cookies}
              rows={4}
              className="w-full p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 font-mono text-xs text-slate-300 resize-none focus:outline-none"
            />
          </div>

          {/* Notes & Comments */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2 font-mono">
              Notes de suivi (ex: motif de suspension, proxy, observations)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ajouter une observation pour ce compte..."
              rows={2}
              className="w-full p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between">
          <button
            onClick={() => handleCopy(fullJsonExport, 'json')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700/80"
          >
            {copiedKey === 'json' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <FileCode className="h-3.5 w-3.5" />}
            <span>Copier JSON</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700/80"
            >
              Fermer
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
            >
              {isSaved ? <Check className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />}
              <span>{isSaved ? 'Enregistré !' : 'Sauvegarder'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

