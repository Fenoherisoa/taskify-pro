import React, { useEffect, useState } from 'react';
import { 
  Save, 
  KeyRound, 
  FileSpreadsheet, 
  Send, 
  Bot, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Zap, 
  ExternalLink,
  ShieldAlert,
  Play,
  Square,
  Copy,
  Check,
  Code2,
  Sparkles
} from 'lucide-react';
import { BotSettings, GoogleSheetField } from '../types';

interface BotSettingsViewProps {
  settings: BotSettings;
  onSaveSettings: (newSettings: Partial<BotSettings>) => Promise<void>;
  onTestGoogleSheets: (url: string) => Promise<{ success: boolean; message?: string; error?: string }>;
}

export const BotSettingsView: React.FC<BotSettingsViewProps> = ({
  settings,
  onSaveSettings,
  onTestGoogleSheets
}) => {
  const [customPassword, setCustomPassword] = useState(settings.customPassword || 'TaskPassword@2025!');
  const [googleSheetWebhookUrl, setGoogleSheetWebhookUrl] = useState(settings.googleSheetWebhookUrl || '');
  const [botToken, setBotToken] = useState(settings.botToken || '');
  const [platformName, setPlatformName] = useState(settings.platformName || 'Taskify Pro');
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; msg?: string } | null>(null);
  const [botToggleLoading, setBotToggleLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const gasScriptCode = `// Google Apps Script pour Taskify Pro
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Si la feuille est vide, ajouter les en-têtes
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp", "ID", "Statut", "UID", 
        "Prénom", "Nom", "Mot de passe", 
        "Cookies", "Telegram User", "Notes"
      ]);
    }
    
    sheet.appendRow([
      data.createdAt || new Date(),
      data.id || "",
      data.status || "compte créé",
      data.uid || "",
      data.firstName || "",
      data.lastName || "",
      data.password || "",
      data.cookies || "",
      data.telegramUsername ? "@" + data.telegramUsername + " (" + data.telegramUserId + ")" : "",
      data.notes || ""
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Row appended successfully"
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleCopyGas = () => {
    navigator.clipboard.writeText(gasScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const GOOGLE_SHEET_FIELDS = [
    { field: 'timestamp', label: 'Date & Heure' },
    { field: 'id', label: 'ID Tâche' },
    { field: 'status', label: 'Statut' },
    { field: 'uid', label: 'UID Facebook' },
    { field: 'firstName', label: 'Prénom' },
    { field: 'lastName', label: 'Nom' },
    { field: 'password', label: 'Mot de passe' },
    { field: 'cookies', label: 'Cookies' },
    { field: 'telegramUserId', label: 'ID Telegram' },
    { field: 'telegramUsername', label: 'Username Telegram' },
    { field: 'notes', label: 'Notes' },
    { field: 'taskType', label: 'Type de tâche' },
    { field: 'rewardUSD', label: 'Reward USD' }
  ];

  const [googleSheetFields, setGoogleSheetFields] = useState<string[]>(
    settings.googleSheetFields || [
      'timestamp',
      'id',
      'status',
      'uid',
      'firstName',
      'lastName',
      'telegramUserId',
      'telegramUsername'
    ]
  );

  useEffect(() => {
    if (Array.isArray(settings.googleSheetFields)) {
      setGoogleSheetFields(settings.googleSheetFields);
    }
  }, [settings.googleSheetFields]);

  const toggleGoogleSheetField = (field: string) => {
    setGoogleSheetFields(prev => {
      if (prev.includes(field)) {
        return prev.filter(item => item !== field);
      }

      return [...prev, field];
    });
  };

  const moveGoogleSheetField = (
    index: number,
    direction: 'up' | 'down'
  ) => {
    setGoogleSheetFields(prev => {
      const next = [...prev];

      const targetIndex =
        direction === 'up'
          ? index - 1
          : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= next.length
      ) {
        return prev;
      }

      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;

      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await onSaveSettings({
        customPassword: customPassword.trim(),
        googleSheetWebhookUrl: googleSheetWebhookUrl.trim(),
        botToken: botToken.trim(),
        platformName: platformName.trim(),
        googleSheetFields: googleSheetFields
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);

    } catch (err) {
      console.error(err);

    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSheets = async () => {
    if (!googleSheetWebhookUrl) {
      setTestStatus({ loading: false, success: false, msg: "Veuillez d'abord saisir l'URL Webhook Google Apps Script." });
      return;
    }

    setTestStatus({ loading: true });
    const res = await onTestGoogleSheets(googleSheetWebhookUrl.trim());
    setTestStatus({
      loading: false,
      success: res.success,
      msg: res.success 
        ? "✅ Connexion Google Sheets réussie ! Une ligne test a été ajoutée dans votre feuille."
        : `❌ Échec du test : ${res.error || 'Erreur inconnue'}`
    });
  };

  const handleToggleBot = async (action: 'start' | 'stop') => {
    setBotToggleLoading(true);
    try {
      const res = await fetch('/api/bot/toggle-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken, action })
      });
      const data = await res.json();
      if (data.success) {
        await onSaveSettings({ isBotActive: data.isBotActive });
      } else {
        alert(data.error || 'Erreur lors du démarrage du bot');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBotToggleLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl glass-card border border-slate-800/80 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <h2 className="text-xl font-extrabold text-white font-sans flex items-center gap-2.5">
              <span>Paramètres & Configuration Système</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PRO CONFIG
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Gérez le mot de passe dynamique distribué par le bot, l'API Google Sheets et le Token Telegram.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
            <span className={`h-2.5 w-2.5 rounded-full ${settings.isBotActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
            <span className="text-xs font-mono text-slate-300 font-semibold">
              Bot en direct : {settings.isBotActive ? 'Actif' : 'Inactif'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Dynamic Password Setting */}
        <div className="p-6 rounded-2xl glass-card border border-slate-800/80 shadow-xl space-y-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base font-sans">
                Mot de Passe Dynamique (Dynamic Password Parameter)
              </h3>
              <p className="text-xs text-slate-400">
                Ce mot de passe est transmis instantanément à chaque utilisateur du bot Telegram lorsqu'il sélectionne la méthode "Cookies".
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                Valeur actuelle du mot de passe
              </label>
              <input
                type="text"
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                placeholder="ex: TaskPassword@2025!"
                className="w-full px-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-indigo-300 font-mono text-sm font-bold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => setCustomPassword(`Taskify_${Math.floor(1000 + Math.random() * 9000)}!#`)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700/80 shadow-sm"
              >
                ⚡ Générer un nouveau
              </button>
            </div>
          </div>
        </div>

        {/* 2. Google Sheets Webhook Configuration */}
        <div className="p-6 rounded-2xl glass-card border border-slate-800/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base font-sans">
                  Intégration Google Sheets (Apps Script Webhook)
                </h3>
                <p className="text-xs text-slate-400">
                  URL de déploiement de l'application Web Google Apps Script (Gratuit et illimité).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyGas}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Code2 className="h-3.5 w-3.5 text-indigo-400" />}
              <span>{copiedCode ? 'Code copié !' : 'Copier Script .gs'}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
              URL Web App (se terminant par /exec)
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="url"
                value={googleSheetWebhookUrl}
                onChange={(e) => setGoogleSheetWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                className="flex-1 px-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
              <button
                type="button"
                onClick={handleTestSheets}
                disabled={testStatus?.loading}
                className="px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                {testStatus?.loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-emerald-400" />}
                <span>Tester la Connexion</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  Champs à envoyer vers Google Sheets
                </h3>

                <p className="text-sm text-muted-foreground">
                  Les champs cochés seront envoyés dans l'ordre affiché.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGoogleSheetFields(
                      GOOGLE_SHEET_FIELDS.map(item => item.field)
                    );
                  }}
                >
                  Tout sélectionner
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGoogleSheetFields([]);
                  }}
                >
                  Tout désélectionner
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {GOOGLE_SHEET_FIELDS.map(item => {
                const index = googleSheetFields.indexOf(item.field);
                const enabled = index !== -1;

                return (
                  <div
                    key={item.field}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() =>
                        toggleGoogleSheetField(item.field)
                      }
                    />

                    <span className="w-8 text-sm font-medium">
                      {enabled ? index + 1 : '—'}
                    </span>

                    <span className="flex-1">
                      {item.label}
                    </span>

                    {enabled && (
                      <>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() =>
                            moveGoogleSheetField(index, 'up')
                          }
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          disabled={
                            index === googleSheetFields.length - 1
                          }
                          onClick={() =>
                            moveGoogleSheetField(index, 'down')
                          }
                        >
                          ↓
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {testStatus && (
            <div className={`p-3.5 rounded-xl border text-xs font-medium ${
              testStatus.success ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              {testStatus.msg}
            </div>
          )}
        </div>

        {/* 3. Telegram Bot Token */}
        <div className="p-6 rounded-2xl glass-card border border-slate-800/80 shadow-xl space-y-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base font-sans">
                Token Telegram Bot (@BotFather)
              </h3>
              <p className="text-xs text-slate-400">
                Optionnel si vous utilisez le Simulateur. Requis pour connecter un bot en direct sur les serveurs Telegram.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
              TELEGRAM_BOT_TOKEN
            </label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="ex: 7892104928:AAH...kL9"
              className="w-full px-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {botToken && (
            <div className="flex items-center gap-3 pt-2">
              {!settings.isBotActive ? (
                <button
                  type="button"
                  onClick={() => handleToggleBot('start')}
                  disabled={botToggleLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>Démarrer le Bot Réel (Polling)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleBot('stop')}
                  disabled={botToggleLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/20 active:scale-95"
                >
                  <Square className="h-4 w-4 fill-white" />
                  <span>Arrêter le Bot Réel</span>
                </button>
              )}
              <span className="text-xs text-slate-400 font-medium">
                {settings.isBotActive ? 'Le bot écoute les messages en temps réel sur Telegram.' : 'Le bot réel est actuellement en pause.'}
              </span>
            </div>
          )}
        </div>

        {/* 4. Platform Title */}
        <div className="p-6 rounded-2xl glass-card border border-slate-800/80 shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
              Nom de la Plateforme / Marque
            </label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-white font-mono text-sm font-semibold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" /> Paramètres enregistrés avec succès !
            </span>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 transition-all active:scale-95"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Enregistrement...' : 'Enregistrer les Paramètres'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

