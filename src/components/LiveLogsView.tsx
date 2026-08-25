import React from 'react';
import { Terminal, RefreshCw, AlertCircle, CheckCircle2, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { BotLog } from '../types';

interface LiveLogsViewProps {
  logs: BotLog[];
  onRefresh: () => void;
}

export const LiveLogsView: React.FC<LiveLogsViewProps> = ({ logs, onRefresh }) => {
  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      default:
        return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'telegram':
        return <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono">TELEGRAM</span>;
      case 'sheets':
        return <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">SHEETS</span>;
      case 'simulator':
        return <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">SIMULATEUR</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">SYSTEM</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-blue-400" />
          <h2 className="font-bold text-white text-sm font-mono">Journal d'Événements en Temps Réel (Live Audit Logs)</h2>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Actualiser</span>
        </button>
      </div>

      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl font-mono text-xs max-h-[550px] overflow-y-auto space-y-2">
        {logs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <div className="flex items-center justify-center gap-2 text-indigo-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs text-slate-400 font-sans font-medium">Écoute active des événements en direct...</span>
            </div>
            <p className="text-[11px] text-slate-600">Aucun log enregistré pour le moment. Les activités du bot s'afficheront ici en temps réel.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start gap-3 hover:bg-slate-900 transition-colors"
            >
              <div className="mt-0.5">{getLogIcon(log.type)}</div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[11px]">
                    {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                  </span>
                  {getSourceBadge(log.source)}
                  <span className="text-slate-200 font-medium">{log.message}</span>
                </div>
                {log.data && (
                  <pre className="text-[10px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800/60 overflow-x-auto">
                    {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
