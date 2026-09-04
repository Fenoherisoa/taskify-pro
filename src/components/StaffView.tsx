import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  UserPlus,
  CheckCircle2,
  XCircle,
  Key,
  AlertCircle,
  RefreshCw,
  Lock,
  Edit2
} from 'lucide-react';
import { StaffMember, StaffRole, Permission, ALL_PERMISSIONS } from '../types';

export const StaffView: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<StaffRole>('ADMIN');
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([...ALL_PERMISSIONS]);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff');
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setStaffList(Array.isArray(data) ? data : []);
      } else if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setStaffList(Array.isArray(data) ? data : []);
        } catch {
          // If server returned HTML during reboot or route fallback, ignore gracefully
          setStaffList([]);
        }
      }
    } catch (err) {
      console.error('Failed to load staff members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleRoleChange = (newRole: StaffRole) => {
    setRole(newRole);
    if (newRole === 'SUPER_ADMIN') {
      setSelectedPermissions([...ALL_PERMISSIONS]);
    } else if (newRole === 'ADMIN') {
      setSelectedPermissions(ALL_PERMISSIONS.filter(p => p !== 'staff'));
    } else if (newRole === 'MANAGER') {
      setSelectedPermissions(['dashboard', 'tasks', 'validation', 'reports', 'audit_logs']);
    }
  };

  const togglePermission = (perm: Permission) => {
    if (selectedPermissions.includes(perm)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== perm));
    } else {
      setSelectedPermissions([...selectedPermissions, perm]);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setActionMessage({ type: 'error', text: 'Nom d\'utilisateur et mot de passe requis.' });
      return;
    }

    setSubmitting(true);
    setActionMessage(null);

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          fullName: fullName.trim() || username.trim(),
          role,
          permissions: selectedPermissions
        })
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setActionMessage({ type: 'success', text: `Membre du personnel @${username} créé avec succès.` });
        setIsCreateModalOpen(false);
        setUsername('');
        setPassword('');
        setFullName('');
        await loadStaff();
      } else {
        setActionMessage({ type: 'error', text: result.message || 'Erreur lors de la création du compte.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Erreur de connexion au serveur.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (staffId: number, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive })
      });

      if (res.ok) {
        await loadStaff();
      }
    } catch (err) {
      console.error('Failed to update staff status:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span>Gestion de l'Équipe & Rôles (RBAC)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Contrôle d'accès basé sur les rôles : SUPER_ADMIN, ADMIN et MANAGER avec permissions granulaires.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadStaff}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Actualiser</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>Ajouter un Membre</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
          }`}
        >
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Staff Table */}
      <div className="glass-card rounded-2xl shadow-xl overflow-hidden border border-slate-800/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                <th className="py-3.5 px-4">Utilisateur / Identité</th>
                <th className="py-3.5 px-4">Rôle</th>
                <th className="py-3.5 px-4">Permissions Clés</th>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-4">Dernière Connexion</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Aucun membre du personnel trouvé.
                  </td>
                </tr>
              ) : (
                staffList.map(s => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{s.fullName}</div>
                      <div className="text-[11px] text-indigo-400 font-mono">@{s.username}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase ${
                          s.role === 'SUPER_ADMIN'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : s.role === 'ADMIN'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        {s.role}
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {(s.permissions || []).slice(0, 4).map(p => (
                          <span
                            key={p}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700"
                          >
                            {p}
                          </span>
                        ))}
                        {(s.permissions || []).length > 4 && (
                          <span className="text-[10px] text-slate-500 font-mono py-0.5">
                            +{s.permissions.length - 4} autres
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {s.isActive ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-semibold">
                          <XCircle className="w-3.5 h-3.5" /> Désactivé
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString('fr-FR') : 'Jamais'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {s.username !== 'admin' && (
                        <button
                          onClick={() => handleToggleStatus(s.id, s.isActive)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            s.isActive
                              ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {s.isActive ? 'Désactiver' : 'Activer'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STAFF MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-card border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <span>Nouveau Membre de l'Équipe</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nom d'utilisateur (Identifiant)</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="ex: manager_jean"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nom Complet</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="ex: Jean Dupont"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Mot de Passe Temporaire</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Rôle</label>
                <select
                  value={role}
                  onChange={e => handleRoleChange(e.target.value as StaffRole)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="MANAGER">MANAGER (Validation des tâches, Rapports)</option>
                  <option value="ADMIN">ADMIN (Opérations, Retraits, Paramètres)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Accès Intégral)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Permissions Granulaires</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800 max-h-36 overflow-y-auto">
                  {ALL_PERMISSIONS.map(p => (
                    <label key={p} className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer font-mono">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(p)}
                        onChange={() => togglePermission(p)}
                        className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md shadow-indigo-600/30"
                >
                  {submitting ? 'Création...' : 'Créer le Compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
