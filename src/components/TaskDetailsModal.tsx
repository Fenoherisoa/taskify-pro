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
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  onClose,
  onUpdateTask,
  onSyncSingle
}) => {
  if (!task) return null;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notes, setNotes] = useState(task.notes || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [isSaved, setIsSaved] = useState(false);

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
          {/* Status & Quick Toggle */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5 font-mono">
                Statut du Compte
              </label>
              <div className="flex items-center gap-2.5">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 font-mono transition-all"
                >
                  <option value="compte créé">✅ Compte Créé (Actif)</option>
                  <option value="compte suspendu">⚠️ Compte Suspendu (Alerte)</option>
                  <option value="vérifié">🛡️ Vérifié (Stable)</option>
                  <option value="en attente">⏳ En Attente</option>
                  <option value="annulé">❌ Annulé</option>
                </select>

                <button
                  onClick={() => onSyncSingle(task)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all shadow-sm"
                  title="Forcer l'envoi vers Google Sheets"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Sync Sheets</span>
                </button>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-500 block font-mono">Identifiant Telegram</span>
              <span className="text-xs font-mono text-slate-300 font-bold">
                {task.telegramUserId} (@{task.telegramUsername})
              </span>
            </div>
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

