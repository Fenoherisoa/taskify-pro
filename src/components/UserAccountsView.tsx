import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Wallet, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  TrendingUp,
  Globe,
  ExternalLink,
  ShieldCheck,
  X,
  CreditCard
} from 'lucide-react';
import { UserAccountRecord } from '../types';
import { fetchUsersApi, updateUserApi, deleteUserWalletInfoApi } from '../services/apiService';

export const UserAccountsView: React.FC = () => {
  const [users, setUsers] = useState<UserAccountRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserAccountRecord | null>(null);
  const [isEditingWallet, setIsEditingWallet] = useState(false);
  const [editUsdt, setEditUsdt] = useState('');
  const [editBinance, setEditBinance] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchUsersApi();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      (u.telegramUsername && u.telegramUsername.toLowerCase().includes(q)) ||
      (u.telegramUserId && u.telegramUserId.toLowerCase().includes(q)) ||
      (u.firstName && u.firstName.toLowerCase().includes(q)) ||
      (u.lastName && u.lastName.toLowerCase().includes(q)) ||
      (u.usdtAddress && u.usdtAddress.toLowerCase().includes(q)) ||
      (u.binanceId && u.binanceId.toLowerCase().includes(q))
    );
  });

  const handleOpenEditWallet = (user: UserAccountRecord) => {
    setSelectedUser(user);
    setEditUsdt(user.usdtAddress || '');
    setEditBinance(user.binanceId || '');
    setIsEditingWallet(true);
    setStatusMessage(null);
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaveLoading(true);
    setStatusMessage(null);
    try {
      const res = await updateUserApi(selectedUser.telegramUserId, {
        usdtAddress: editUsdt.trim() || null,
        binanceId: editBinance.trim() || null
      });
      if (res.success) {
        setStatusMessage({ type: 'success', text: 'Coordonnées de portefeuille enregistrées avec succès.' });
        setIsEditingWallet(false);
        await loadUsers();
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Erreur lors de la mise à jour.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Erreur de connexion.' });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteWallet = async (user: UserAccountRecord) => {
    if (!confirm(`Supprimer définitivement les coordonnées de retrait pour @${user.telegramUsername || user.telegramUserId} ?`)) {
      return;
    }
    try {
      const res = await deleteUserWalletInfoApi(user.telegramUserId);
      if (res.success) {
        setStatusMessage({ type: 'success', text: 'Coordonnées de portefeuille supprimées.' });
        await loadUsers();
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Erreur de suppression.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const totalUsers = users.length;
  const totalBalances = users.reduce((acc, u) => acc + (u.balance || 0), 0);
  const totalEarnedAll = users.reduce((acc, u) => acc + (u.totalEarned || 0), 0);
  const totalWithdrawnAll = users.reduce((acc, u) => acc + (u.totalWithdrawn || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top statistics overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Travailleurs</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white mt-2 font-mono">{totalUsers}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Comptes Telegram enregistrés</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Soldes Disponibles</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 mt-2 font-mono">${totalBalances.toFixed(2)}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Actuellement dus aux utilisateurs</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Gains Cumulés</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-blue-400 mt-2 font-mono">${totalEarnedAll.toFixed(2)}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Gains totaux générés</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Payé (Retraits)</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-purple-400 mt-2 font-mono">${totalWithdrawnAll.toFixed(2)}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Fonds déjà décaissés</span>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs flex items-center justify-between ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-200' 
            : 'bg-rose-500/15 border border-rose-500/30 text-rose-200'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <span>Gestion des Comptes Utilisateurs & Portefeuilles</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Supervision des opérateurs Telegram, soldes réels, tâches et coordonnées de retrait (USDT / Binance ID).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par ID, nom, wallet..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            <button
              onClick={loadUsers}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all shrink-0"
              title="Actualiser la liste"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                <th className="py-3.5 px-4">Utilisateur Telegram</th>
                <th className="py-3.5 px-4">Langue</th>
                <th className="py-3.5 px-4">Solde Dispo</th>
                <th className="py-3.5 px-4">Tâches (Validées/En attente/Rejetées)</th>
                <th className="py-3.5 px-4">Coordonnées de Retrait</th>
                <th className="py-3.5 px-4 text-right">Actions Portefeuille</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    {loading ? 'Chargement des comptes...' : 'Aucun utilisateur trouvé.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const hasWallet = Boolean(u.usdtAddress || u.binanceId);
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">
                          @{u.telegramUsername || 'anonyme'}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>ID: {u.telegramUserId}</span>
                          {(u.firstName || u.lastName) && (
                            <span>• {u.firstName} {u.lastName}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-bold text-[10px] border border-slate-700">
                          {u.language || 'fr'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-emerald-400 text-sm">
                          ${u.balance.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Gagné: ${u.totalEarned.toFixed(2)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px] font-bold border border-emerald-500/20" title="Validées">
                            ✓ {u.tasksCompleted}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[10px] font-bold border border-amber-500/20" title="En attente">
                            ⏳ {u.tasksPending}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 text-[10px] font-bold border border-rose-500/20" title="Rejetées">
                            ✕ {u.tasksRejected}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        {hasWallet ? (
                          <div className="space-y-1">
                            {u.usdtAddress && (
                              <div className="text-[11px] truncate text-slate-300 flex items-center gap-1" title={u.usdtAddress}>
                                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300">USDT</span>
                                <span className="font-mono">{u.usdtAddress.slice(0, 10)}...{u.usdtAddress.slice(-6)}</span>
                              </div>
                            )}
                            {u.binanceId && (
                              <div className="text-[11px] truncate text-slate-300 flex items-center gap-1" title={u.binanceId}>
                                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300">BINANCE</span>
                                <span className="font-mono">{u.binanceId}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Non configuré</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditWallet(u)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
                            title="Ajouter ou modifier les coordonnées de retrait"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{hasWallet ? 'Modifier' : 'Ajouter'}</span>
                          </button>

                          {hasWallet && (
                            <button
                              onClick={() => handleDeleteWallet(u)}
                              className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs transition-all"
                              title="Supprimer les coordonnées"
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

      {/* Edit Wallet Modal */}
      {isEditingWallet && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">
                  Coordonnées de Retrait
                </h3>
              </div>
              <button
                onClick={() => setIsEditingWallet(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Modifier les coordonnées de paiement pour l'utilisateur{' '}
              <strong className="text-white">@{selectedUser.telegramUsername || selectedUser.telegramUserId}</strong>.
              Méthodes autorisées : <span className="text-emerald-400 font-semibold">USDT TRC-20</span> et <span className="text-amber-400 font-semibold">Binance ID</span> uniquement.
            </p>

            <form onSubmit={handleSaveWallet} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono">
                  Adresse USDT (TRC-20)
                </label>
                <input
                  type="text"
                  value={editUsdt}
                  onChange={(e) => setEditUsdt(e.target.value)}
                  placeholder="ex: T9yD14Nj9j7xAB4dbGeiX9h8unkKHXUnTR"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono">
                  Binance Pay ID / UID
                </label>
                <input
                  type="text"
                  value={editBinance}
                  onChange={(e) => setEditBinance(e.target.value)}
                  placeholder="ex: 182937102"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingWallet(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2"
                >
                  {saveLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
