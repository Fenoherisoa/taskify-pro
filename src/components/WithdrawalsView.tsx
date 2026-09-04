import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Wallet,
  FileText,
  AlertCircle,
  Send,
  User
} from 'lucide-react';
import { WithdrawalRecord, WithdrawalStatus, WalletRecord, TransactionRecord } from '../types';
import { fetchWithdrawals, processWithdrawalApi } from '../services/apiService';

interface WithdrawalsViewProps {
  onRefreshStats?: () => void;
}

export const WithdrawalsView: React.FC<WithdrawalsViewProps> = ({ onRefreshStats }) => {
  const [activeSubTab, setActiveSubTab] = useState<'withdrawals' | 'wallets' | 'ledger'>('withdrawals');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRecord | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAllFinancialData = async () => {
    setLoading(true);
    try {
      const [wList, wRes, tRes] = await Promise.all([
        fetchWithdrawals(),
        fetch('/api/wallets')
          .then(r => (r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : []))
          .catch(() => []),
        fetch('/api/transactions')
          .then(r => (r.ok && r.headers.get('content-type')?.includes('application/json') ? r.json() : []))
          .catch(() => [])
      ]);

      setWithdrawals(wList);
      setWallets(Array.isArray(wRes) ? wRes : []);
      setTransactions(Array.isArray(tRes) ? tRes : []);
    } catch (err) {
      console.error('Failed to load financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllFinancialData();
  }, []);

  const handleProcess = async (id: number, action: WithdrawalStatus) => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/withdrawals/${id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminId: 'admin_portal', notes: adminNotes })
      });
      const data = await res.json();

      if (data.success) {
        setActionMessage({ type: 'success', text: data.message || `Retrait ${action} avec succès.` });
        setSelectedWithdrawal(null);
        setAdminNotes('');
        await loadAllFinancialData();
        if (onRefreshStats) onRefreshStats();
      } else {
        setActionMessage({ type: 'error', text: data.message || 'Erreur lors du traitement.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Erreur de connexion au serveur.' });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredWithdrawals = withdrawals.filter(w => {
    const matchesFilter = statusFilter === 'all' || w.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (w.destination && w.destination.toLowerCase().includes(q)) ||
      (w.method && w.method.toLowerCase().includes(q)) ||
      (w.telegramUserId && w.telegramUserId.toLowerCase().includes(q)) ||
      (w.telegramUsername && w.telegramUsername.toLowerCase().includes(q)) ||
      String(w.id).includes(q);
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: WithdrawalStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" /> En attente
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <CheckCircle2 className="w-3 h-3" /> Approuvé
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> En cours
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Payé
          </span>
        );
      case 'rejected':
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3 h-3" /> {status === 'rejected' ? 'Rejeté' : 'Annulé'}
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const totalPendingPayout = withdrawals
    .filter(w => w.status === 'pending' || w.status === 'approved' || w.status === 'processing')
    .reduce((sum, w) => sum + Number(w.amount), 0);

  const totalPaidOut = withdrawals
    .filter(w => w.status === 'paid')
    .reduce((sum, w) => sum + Number(w.amount), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Financial Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-mono uppercase tracking-wider block">Total Retraits En Attente</span>
            <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">
              ${totalPendingPayout.toFixed(2)} USD
            </span>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-mono uppercase tracking-wider block">Total Payé aux Opérateurs</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
              ${totalPaidOut.toFixed(2)} USD
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-mono uppercase tracking-wider block">Portefeuilles Actifs</span>
            <span className="text-2xl font-bold font-mono text-indigo-400 mt-1 block">
              {wallets.length} Comptes
            </span>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-4">
        <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSubTab('withdrawals')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              activeSubTab === 'withdrawals'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Demandes de Retraits ({withdrawals.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('wallets')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              activeSubTab === 'wallets'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Soldes & Portefeuilles ({wallets.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ledger')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              activeSubTab === 'ledger'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Grand Livre des Transactions ({transactions.length})</span>
          </button>
        </div>

        <button
          onClick={loadAllFinancialData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Actualiser</span>
        </button>
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

      {/* VIEW 1: WITHDRAWALS TABLE */}
      {activeSubTab === 'withdrawals' && (
        <div className="glass-card rounded-2xl shadow-xl overflow-hidden border border-slate-800/80">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-900/40">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par ID, Telegram, méthode ou compte..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs flex-wrap">
              {(['all', 'pending', 'approved', 'processing', 'paid', 'rejected'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {status === 'all' ? 'Tous' : status}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  <th className="py-3 px-4">ID & Date</th>
                  <th className="py-3 px-4">Utilisateur Telegram</th>
                  <th className="py-3 px-4">Montant</th>
                  <th className="py-3 px-4">Méthode & Destination</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Aucune demande de retrait trouvée.
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map(w => (
                    <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-slate-200">#{w.id}</span>
                        <div className="text-[11px] text-slate-500">
                          {new Date(w.createdAt).toLocaleDateString('fr-FR')} {new Date(w.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">
                          @{w.telegramUsername || 'anonyme'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {w.telegramUserId}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-base text-emerald-400">
                        ${Number(w.amount).toFixed(2)} USD
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <span className="font-semibold text-slate-200 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {w.method}
                        </span>
                        <div className="text-slate-400 mt-1 select-all font-mono">
                          {w.destination}
                        </div>
                      </td>

                      <td className="py-3 px-4">{getStatusBadge(w.status)}</td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {w.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleProcess(w.id, 'approved')}
                                disabled={actionLoading}
                                className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-semibold"
                                title="Approuver pour traitement"
                              >
                                Approuver
                              </button>
                              <button
                                onClick={() => handleProcess(w.id, 'rejected')}
                                disabled={actionLoading}
                                className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold"
                                title="Rejeter et rembourser le solde"
                              >
                                Rejeter
                              </button>
                            </>
                          )}

                          {w.status === 'approved' && (
                            <>
                              <button
                                onClick={() => handleProcess(w.id, 'processing')}
                                disabled={actionLoading}
                                className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-semibold"
                              >
                                En cours
                              </button>
                              <button
                                onClick={() => handleProcess(w.id, 'paid')}
                                disabled={actionLoading}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold"
                              >
                                Marquer Payé
                              </button>
                            </>
                          )}

                          {w.status === 'processing' && (
                            <button
                              onClick={() => handleProcess(w.id, 'paid')}
                              disabled={actionLoading}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold"
                            >
                              Confirmer Paiement
                            </button>
                          )}

                          {['paid', 'rejected', 'cancelled'].includes(w.status) && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              Finalisé
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: WALLETS TABLE */}
      {activeSubTab === 'wallets' && (
        <div className="glass-card rounded-2xl shadow-xl overflow-hidden border border-slate-800/80">
          <div className="p-4 border-b border-slate-800 bg-slate-900/40">
            <h3 className="text-sm font-bold text-slate-200">Portefeuilles & Soldes Actuels (Source PostgreSQL)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Soldes disponibles, fonds réservés pour retraits et historique des gains cumulés.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  <th className="py-3 px-4">Utilisateur Telegram</th>
                  <th className="py-3 px-4">Solde Disponible</th>
                  <th className="py-3 px-4">En Cours de Retrait</th>
                  <th className="py-3 px-4">Total Gagné</th>
                  <th className="py-3 px-4">Total Payé</th>
                  <th className="py-3 px-4 text-right">Dernière MàJ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {wallets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Aucun portefeuille utilisateur enregistré.
                    </td>
                  </tr>
                ) : (
                  wallets.map(w => (
                    <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">
                          @{w.telegram_username || 'anonyme'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          ID: {w.telegram_user_id}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-emerald-400 text-sm">
                        ${Number(w.balance).toFixed(3)} USD
                      </td>

                      <td className="py-3 px-4 font-bold text-amber-400">
                        ${Number(w.pending_withdrawal || 0).toFixed(2)} USD
                      </td>

                      <td className="py-3 px-4 text-indigo-300">
                        ${Number(w.total_earned || 0).toFixed(3)} USD
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        ${Number(w.total_withdrawn || 0).toFixed(2)} USD
                      </td>

                      <td className="py-3 px-4 text-right text-[11px] text-slate-500">
                        {w.updated_at ? new Date(w.updated_at).toLocaleDateString('fr-FR') : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: TRANSACTION LEDGER */}
      {activeSubTab === 'ledger' && (
        <div className="glass-card rounded-2xl shadow-xl overflow-hidden border border-slate-800/80">
          <div className="p-4 border-b border-slate-800 bg-slate-900/40">
            <h3 className="text-sm font-bold text-slate-200">Grand Livre des Transactions Financières</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Historique immuable de chaque crédit de récompense, demande de retrait et règlement.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  <th className="py-3 px-4">Date & Heure</th>
                  <th className="py-3 px-4">Utilisateur</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Montant</th>
                  <th className="py-3 px-4">Solde Avant / Après</th>
                  <th className="py-3 px-4">Description / Réf</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      Aucune transaction financière enregistrée.
                    </td>
                  </tr>
                ) : (
                  transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-[11px] text-slate-400">
                        {new Date(t.createdAt).toLocaleString('fr-FR')}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-200">
                          @{t.telegramUsername || 'anonyme'}
                        </span>
                        <div className="text-[10px] text-slate-500">ID: {t.telegramUserId}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.type === 'task_reward'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : t.type === 'withdrawal_request'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : t.type === 'withdrawal_paid'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {t.type}
                        </span>
                      </td>

                      <td
                        className={`py-3 px-4 font-bold ${
                          Number(t.amount) > 0
                            ? 'text-emerald-400'
                            : Number(t.amount) < 0
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {Number(t.amount) > 0 ? `+$${Number(t.amount).toFixed(3)}` : `$${Number(t.amount).toFixed(2)}`}
                      </td>

                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        ${Number(t.balanceBefore).toFixed(3)} → ${Number(t.balanceAfter).toFixed(3)}
                      </td>

                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate" title={t.description}>
                        {t.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
