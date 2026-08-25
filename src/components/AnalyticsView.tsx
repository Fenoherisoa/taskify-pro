import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  CartesianGrid,
  Legend
} from 'recharts';
import { 
  ShieldCheck, 
  AlertOctagon, 
  CheckCircle2, 
  Activity, 
  TrendingUp,
  PieChart as PieIcon,
  Sparkles
} from 'lucide-react';
import { TaskRecord } from '../types';

interface AnalyticsViewProps {
  tasks: TaskRecord[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ tasks }) => {
  const createdCount = tasks.filter(t => t.status === 'compte créé').length;
  const suspendedCount = tasks.filter(t => t.status === 'compte suspendu').length;
  const verifiedCount = tasks.filter(t => t.status === 'vérifié').length;
  const pendingCount = tasks.filter(t => t.status === 'en attente').length;
  const total = tasks.length;

  const successRate = total > 0 ? Math.round(((createdCount + verifiedCount) / total) * 100) : 100;
  const suspensionRate = total > 0 ? Math.round((suspendedCount / total) * 100) : 0;

  // Pie chart data
  const pieData = [
    { name: 'Comptes Créés', value: createdCount, color: '#10b981' },
    { name: 'Comptes Suspendus', value: suspendedCount, color: '#f43f5e' },
    { name: 'Vérifiés', value: verifiedCount, color: '#6366f1' },
    { name: 'En Attente', value: pendingCount, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  // Group by day / time periods for trend line dynamically from real tasks
  const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const today = new Date();
  const activityData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(today.getDate() - (6 - i));
    const dayName = daysOfWeek[d.getDay()];
    const dateStr = d.toISOString().slice(0, 10);
    
    // Count real tasks on this date
    const dayTasks = tasks.filter(t => t.createdAt && t.createdAt.slice(0, 10) === dateStr);
    const dayCreated = dayTasks.filter(t => t.status === 'compte créé' || t.status === 'vérifié').length;
    const daySuspended = dayTasks.filter(t => t.status === 'compte suspendu').length;

    return {
      day: dayName,
      date: dateStr,
      créés: dayCreated,
      suspendus: daySuspended
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="p-6 rounded-2xl glass-card border border-slate-800/80 shadow-xl flex items-center justify-between group hover:border-emerald-500/40 transition-all">
          <div>
            <span className="text-xs uppercase font-bold text-slate-400 block mb-1 font-mono tracking-wider">
              Taux de Réussite
            </span>
            <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">{successRate}%</span>
            <span className="text-xs text-slate-500 block mt-1">Comptes opérationnels & vérifiés</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        <div className="p-6 rounded-2xl glass-card border border-slate-800/80 shadow-xl flex items-center justify-between group hover:border-rose-500/40 transition-all">
          <div>
            <span className="text-xs uppercase font-bold text-slate-400 block mb-1 font-mono tracking-wider">
              Taux de Suspension
            </span>
            <span className="text-3xl font-black text-rose-400 font-mono tracking-tight">{suspensionRate}%</span>
            <span className="text-xs text-slate-500 block mt-1">{suspendedCount} blocage(s) recensé(s)</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform">
            <AlertOctagon className="h-6 w-6" />
          </div>
        </div>

        <div className="p-6 rounded-2xl glass-card border border-slate-800/80 shadow-xl flex items-center justify-between group hover:border-indigo-500/40 transition-all">
          <div>
            <span className="text-xs uppercase font-bold text-slate-400 block mb-1 font-mono tracking-wider">
              Volume Total Traité
            </span>
            <span className="text-3xl font-black text-indigo-400 font-mono tracking-tight">{total}</span>
            <span className="text-xs text-slate-500 block mt-1">Tâches Bot Telegram & Web</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform">
            <Activity className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Trend Bar Chart */}
        <div className="p-6 rounded-2xl glass-card border border-slate-800/80 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-extrabold text-white text-base font-sans">Évolution Hebdomadaire des Tâches</h3>
              <p className="text-xs text-slate-400 mt-0.5">Comptes créés vs Comptes suspendus</p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.6} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    borderColor: 'rgba(51, 65, 85, 0.8)', 
                    borderRadius: '12px', 
                    fontSize: '12px', 
                    color: '#f8fafc',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                <Bar dataKey="créés" fill="#10b981" radius={[6, 6, 0, 0]} name="Comptes Créés" />
                <Bar dataKey="suspendus" fill="#f43f5e" radius={[6, 6, 0, 0]} name="Comptes Suspendus" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Status Breakdown Pie Chart */}
        <div className="p-6 rounded-2xl glass-card border border-slate-800/80 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-extrabold text-white text-base font-sans">Répartition Globale par Statut</h3>
              <p className="text-xs text-slate-400 mt-0.5">État en temps réel du parc de comptes</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <PieIcon className="h-4 w-4" />
            </div>
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(15, 23, 42, 0.8)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      borderColor: 'rgba(51, 65, 85, 0.8)', 
                      borderRadius: '12px', 
                      fontSize: '12px', 
                      color: '#f8fafc',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 font-mono">Aucune donnée à afficher pour le moment</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

