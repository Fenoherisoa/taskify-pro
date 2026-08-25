import React, { useState } from 'react';
import { X, Plus, RefreshCw, KeyRound, User, CheckCircle2 } from 'lucide-react';
import { generateRandomName } from '../data/names';
import { BotSettings, TaskStatus } from '../types';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: any) => void;
  settings: BotSettings;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  settings
}) => {
  if (!isOpen) return null;

  const [names, setNames] = useState(generateRandomName());
  const [uid, setUid] = useState('');
  const [cookies, setCookies] = useState('');
  const [password, setPassword] = useState(settings.customPassword || 'TaskPassword@2025!');
  const [status, setStatus] = useState<TaskStatus>('compte créé');
  const [notes, setNotes] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('admin_direct');

  const handleRegenerateName = () => {
    setNames(generateRandomName());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid.trim()) return;

    onSubmit({
      uid: uid.trim(),
      cookies: cookies.trim(),
      firstName: names.firstName,
      lastName: names.lastName,
      password: password.trim(),
      status,
      notes: notes.trim(),
      telegramUserId: 'admin_' + Math.floor(Math.random() * 100000),
      telegramUsername: telegramUsername.trim() || 'admin_direct',
      taskType: 'Facebook'
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-card border border-slate-800/80 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white font-sans">Ajouter une Tâche Manuelle</h3>
              <p className="text-xs text-slate-400 mt-0.5">Enregistrer manuellement un compte avec UID et cookies</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs sm:text-sm">
          {/* Generated Name Row */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold text-slate-400 block mb-0.5 font-mono tracking-wider">Identité Générée</span>
              <span className="font-extrabold text-white text-base">
                {names.firstName} {names.lastName}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRegenerateName}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700/80 transition-all"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Changer</span>
            </button>
          </div>

          {/* UID */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
              UID Facebook *
            </label>
            <input
              type="text"
              required
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="ex: 100084928172910"
              className="w-full px-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Mot de passe & Statut */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                Mot de passe
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-indigo-300 font-mono font-bold focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                Statut Initial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:border-indigo-500 transition-all"
              >
                <option value="compte créé">Compte créé (Actif)</option>
                <option value="compte suspendu">Compte suspendu</option>
                <option value="vérifié">Vérifié</option>
                <option value="en attente">En attente</option>
              </select>
            </div>
          </div>

          {/* Cookies */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
              Cookies Facebook
            </label>
            <textarea
              rows={3}
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder="ex: datr=...; c_user=...; xs=...;"
              className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-slate-300 font-mono text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Username Telegram & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                Username Telegram
              </label>
              <input
                type="text"
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value)}
                placeholder="admin_taskify"
                className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-slate-300 font-mono focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optionnel..."
                className="w-full px-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700/80 transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
            >
              Enregistrer la tâche
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

