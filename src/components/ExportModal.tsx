import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check, FileCode, Package, FileText, Code2 } from 'lucide-react';
import { STANDALONE_TEMPLATES } from '../data/exportTemplates';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [activeFile, setActiveFile] = useState<'botJs' | 'googleAppsScript' | 'packageJson' | 'envExample' | 'readme'>('botJs');
  const [fileData, setFileData] = useState<any>(STANDALONE_TEMPLATES);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/export-files')
      .then(res => {
        if (!res.ok) return null;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return null;
        return res.json();
      })
      .then(data => {
        if (data && data.botJs) {
          setFileData(data);
        }
      })
      .catch(() => {
        // Silently use STANDALONE_TEMPLATES
      });
  }, []);

  const getActiveContent = () => {
    const data = fileData || STANDALONE_TEMPLATES;
    switch (activeFile) {
      case 'botJs': return data.botJs;
      case 'googleAppsScript': return data.googleAppsScript;
      case 'packageJson': return data.packageJson;
      case 'envExample': return data.envExample;
      case 'readme': return data.readme;
      default: return '';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = activeFile === 'botJs' ? 'bot.js' :
                     activeFile === 'googleAppsScript' ? 'Code.gs' :
                     activeFile === 'packageJson' ? 'package.json' :
                     activeFile === 'envExample' ? '.env' : 'README.md';

    const element = document.createElement('a');
    const file = new Blob([getActiveContent()], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Exportation du Code Standalone</h3>
              <p className="text-xs text-slate-400">Téléchargez ou copiez les scripts indépendants prêts au déploiement</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4 gap-2 pt-2">
          <button
            onClick={() => setActiveFile('botJs')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 ${
              activeFile === 'botJs' ? 'border-blue-500 text-white bg-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="h-3.5 w-3.5 text-blue-400" />
            <span>bot.js (Telegram Bot)</span>
          </button>

          <button
            onClick={() => setActiveFile('googleAppsScript')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 ${
              activeFile === 'googleAppsScript' ? 'border-emerald-500 text-white bg-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="h-3.5 w-3.5 text-emerald-400" />
            <span>Code.gs (Google Sheets)</span>
          </button>

          <button
            onClick={() => setActiveFile('packageJson')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 ${
              activeFile === 'packageJson' ? 'border-indigo-500 text-white bg-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="h-3.5 w-3.5 text-indigo-400" />
            <span>package.json</span>
          </button>

          <button
            onClick={() => setActiveFile('envExample')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 ${
              activeFile === 'envExample' ? 'border-amber-500 text-white bg-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5 text-amber-400" />
            <span>.env</span>
          </button>
        </div>

        {/* Code Content */}
        <div className="p-4 flex-1 overflow-y-auto bg-slate-950">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto select-all p-3 rounded-lg bg-slate-900 border border-slate-800">
            {getActiveContent()}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Code Copié !' : 'Copier le Fichier'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all"
          >
            <Download className="h-4 w-4" />
            <span>Télécharger le Fichier</span>
          </button>
        </div>
      </div>
    </div>
  );
};
