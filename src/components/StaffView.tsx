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
  Edit2,
  Trash2,
  X,
  Check
} from 'lucide-react';
import { StaffMember, StaffRole, Permission, ALL_PERMISSIONS } from '../types';
import { fetchAllStaffApi, createStaffApi, updateStaffApi, deleteStaffApi } from '../services/apiService';

interface StaffViewProps {
  currentStaff?: StaffMember | null;
}

export const StaffView: React.FC<StaffViewProps> = ({ currentStaff }) => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<StaffRole>('ADMIN');
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([...ALL_PERMISSIONS]);
  
  // Edit Modal State
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<StaffRole>('ADMIN');
  const [editPermissions, setEditPermissions] = useState<Permission[]>([]);
  const [editPassword, setEditPassword] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await fetchAllStaffApi();
      setStaffList(Array.isArray(data) ? data : []);
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
      setSelectedPermissions(['tasks', 'validation', 'reports', 'audit_logs']);
    }
  };

  const handleEditRoleChange = (newRole: StaffRole) => {
    setEditRole(newRole);
    if (newRole === 'SUPER_ADMIN') {
      setEditPermissions([...ALL_PERMISSIONS]);
    } else if (newRole === 'ADMIN') {
      setEditPermissions(ALL_PERMISSIONS.filter(p => p !== 'staff'));
    } else if (newRole === 'MANAGER') {
      setEditPermissions(['tasks', 'validation', 'reports', 'audit_logs']);
    }
  };

  const togglePermission = (perm: Permission) => {
    if (selectedPermissions.includes(perm)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== perm));
    } else {
      setSelectedPermissions([...selectedPermissions, perm]);
    }
  };

  const toggleEditPermission = (perm: Permission) => {
    if (editPermissions.includes(perm)) {
      setEditPermissions(editPermissions.filter(p => p !== perm));
    } else {
      setEditPermissions([...editPermissions, perm]);
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
      const result = await createStaffApi({
        username: username.trim(),
        password: password.trim(),
        fullName: fullName.trim() || username.trim(),
        role,
        permissions: selectedPermissions
      });

      if (result && result.success) {
        setActionMessage({ type: 'success', text: `Collaborateur @${username} créé avec succès.` });
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

  const openEditModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setEditFullName(staff.fullName || '');
    setEditRole(staff.role);
    setEditPermissions(staff.permissions || []);
    setEditPassword('');
    setEditIsActive(staff.isActive);
    setActionMessage(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setSubmitting(true);
    setActionMessage(null);

    try {
      const updates: any = {
        fullName: editFullName.trim() || editingStaff.username,
        role: editRole,
        permissions: editPermissions,
        isActive: editIsActive
      };

      if (editPassword.trim()) {
        updates.password = editPassword.trim();
      }

      const res = await updateStaffApi(editingStaff.id, updates);
      if (res && res.success) {
        setActionMessage({ type: 'success', text: `Informations de @${editingStaff.username} mises à jour avec succès.` });
        setEditingStaff(null);
        await loadStaff();
      } else {
        setActionMessage({ type: 'error', text: res.message || 'Erreur de mise à jour.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (staff: StaffMember) => {
    if (!confirm(`Confirmez-vous la suppression définitive du compte de @${staff.username} (${staff.fullName}) ?`)) {
      return;
    }

    try {
      const res = await deleteStaffApi(staff.id);
      if (res.success) {
        setActionMessage({ type: 'success', text: `Compte @${staff.username} supprimé avec succès.` });
        await loadStaff();
      } else {
        setActionMessage({ type: 'error', text: res.message || 'Erreur lors de la suppression.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleToggleStatus = async (staffId: number, currentActive: boolean) => {
    try {
      const res = await updateStaffApi(staffId, { isActive: !currentActive });
      if (res && res.success) {
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
            <span>Gestion de l'Équipe & Contrôle d'Accès (RBAC)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gérez les membres de l'équipe, leurs rôles (SUPER_ADMIN, ADMIN, MANAGER), coordonnées et permissions d'accès.
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
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                <th className="py-3.5 px-4">Utilisateur / Nom Complet</th>
                <th className="py-3.5 px-4">Rôle</th>
                <th className="py-3.5 px-4">Permissions Clés</th>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-4">Dernière Connexion</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    {loading ? 'Chargement des collaborateurs...' : 'Aucun membre du personnel trouvé.'}
                  </td>
                </tr>
              ) : (
                staffList.map(s => {
                  const isCurrent = currentStaff && currentStaff.id === s.id;
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-2 font-sans">
                          <span>{s.fullName}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                              (Vous)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-indigo-400 font-mono mt-0.5">@{s.username}</div>
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
                        <button
                          onClick={() => handleToggleStatus(s.id, s.isActive)}
                          disabled={s.username === 'admin'}
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg border transition-all ${
                            s.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-300 hover:border-rose-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/20'
                          }`}
                          title="Cliquer pour basculer"
                        >
                          {s.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          <span>{s.isActive ? 'Actif' : 'Désactivé'}</span>
                        </button>
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString('fr-FR') : 'Jamais'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(s)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
                            title="Modifier les informations"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Modifier</span>
                          </button>

                          {s.username !== 'admin' && !isCurrent && (
                            <button
                              onClick={() => handleDeleteStaff(s)}
                              className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs transition-all"
                              title="Supprimer ce membre"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT STAFF MODAL */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                <span>Modifier le Collaborateur (@{editingStaff.username})</span>
              </h3>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nom Complet</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={e => setEditFullName(e.target.value)}
                  placeholder="ex: Jean Dupont"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nouveau Mot de Passe (laisser vide pour ne pas modifier)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="Laisser vide pour conserver l'actuel"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Rôle</label>
                <select
                  value={editRole}
                  onChange={e => handleEditRoleChange(e.target.value as StaffRole)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
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
                        checked={editPermissions.includes(p)}
                        onChange={() => toggleEditPermission(p)}
                        className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={e => setEditIsActive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                />
                <label htmlFor="editIsActive" className="text-slate-300 font-semibold cursor-pointer">
                  Compte actif (autoriser la connexion)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md shadow-indigo-600/30"
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE STAFF MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <span>Nouveau Membre de l'Équipe</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800"
              >
                <X className="w-4 h-4" />
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
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nom Complet</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="ex: Jean Dupont"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Mot de Passe Initial</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Rôle</label>
                <select
                  value={role}
                  onChange={e => handleRoleChange(e.target.value as StaffRole)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
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
