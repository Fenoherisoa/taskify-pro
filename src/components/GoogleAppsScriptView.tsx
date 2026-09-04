import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Play, 
  Download,
  KeyRound,
  FileCode
} from 'lucide-react';

export const GoogleAppsScriptView: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const appsScriptCode = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - Taskify Pro Database Webhook (@TaskifyProBot)
 * =========================================================================
 * 100% GRATUIT A VIE (Aucune carte bancaire requise)
 * 
 * Instructions de déploiement :
 * 1. Ouvrez Google Sheets -> Créez une feuille vierge
 * 2. Menu : Extensions -> Apps Script
 * 3. Supprimez tout et collez ce script complet
 * 4. Cliquez sur "Déployer" (en haut à droite) -> "Nouveau déploiement"
 * 5. Type : "Application Web"
 *    - Description : "Taskify Pro API"
 *    - Exécuter en tant que : "Moi (votre compte Google)"
 *    - Qui a accès : "Tout le monde" (IMPORTANT !)
 * 6. Cliquez sur Déployer, Autorisez l'accès, puis copiez l'URL Web App (se termine par /exec)
 * 7. Collez cette URL dans le Dashboard Taskify Pro !
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Évite les écritures simultanées conflictuelles

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Initialise les en-têtes si la feuille est vide
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Date & Heure",
        "ID Tâche",
        "Statut",
        "UID Facebook",
        "Prénom",
        "Nom",
        "Mot de passe",
        "Cookies",
        "ID Telegram",
        "Username Telegram",
        "Notes"
      ]);
      // Met en forme l'en-tête (Gras + Fond bleu foncé RFC)
      var headerRange = sheet.getRange(1, 1, 1, 11);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1e293b");
      headerRange.setFontColor("#ffffff");
    }

    var contents = e.postData.contents;
    var payload = JSON.parse(contents);
    var data = payload.data || payload;

    var now = new Date();
    var formattedDate = Utilities.formatDate(now, "Europe/Paris", "yyyy-MM-dd HH:mm:ss");

    var taskId = String(data.id || payload.id || "").trim();
    var uid = String(data.uid || payload.uid || "").trim();
    var statusText = data.status || "compte créé";
    if (data.accountStatus && data.accountStatus !== "pending_verification") {
      statusText = (data.accountStatus === "verified" ? "VERIFIE" : "SUSPENDU") + " (" + statusText + ")";
    }

    var rowValues = [
      formattedDate,
      taskId || ("task-" + now.getTime()),
      statusText,
      "'" + uid, // Force en chaîne pour préserver les zéros initiaux
      data.firstName || "",
      data.lastName || "",
      data.password || "",
      data.cookies || "",
      "'" + (data.telegramUserId || ""),
      "@" + (data.telegramUsername || "").replace("@", ""),
      data.notes || data.verificationReason || ""
    ];

    // Recherche de ligne existante par ID Tâche (colonne 2) ou UID (colonne 4) pour éviter les doublons
    var lastRow = sheet.getLastRow();
    var existingRowIndex = -1;

    if (lastRow > 1 && (taskId || uid)) {
      var existingData = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
      for (var i = 0; i < existingData.length; i++) {
        var rowTaskId = String(existingData[i][1]).trim();
        var rowUid = String(existingData[i][3]).replace(/^'/, '').trim();
        if ((taskId && rowTaskId === taskId) || (uid && rowUid === uid)) {
          existingRowIndex = i + 2; // Conversion en index de ligne 1-based dans la feuille
          break;
        }
      }
    }

    if (existingRowIndex > 0) {
      // Met à jour la ligne existante sans créer de doublon
      sheet.getRange(existingRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "updated",
        message: "Ligne existante mise à jour avec succès (par ID de tâche)",
        rowNumber: existingRowIndex,
        taskId: taskId,
        uid: uid
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // Nouvelle tâche : insertion d'une nouvelle ligne
      sheet.appendRow(rowValues);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "inserted",
        message: "Nouvelle tâche enregistrée avec succès dans Google Sheets",
        rowNumber: sheet.getLastRow(),
        taskId: taskId,
        uid: uid
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    platform: "Taskify Pro",
    bot: "@TaskifyProBot",
    message: "Google Apps Script Webhook API est fonctionnel !"
  })).setMimeType(ContentService.MimeType.JSON);
}
`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const columns = [
    { title: 'Date & Heure', desc: 'Horodatage Europe/Paris' },
    { title: 'ID Tâche', desc: 'Identifiant unique (task-xxx)' },
    { title: 'Statut', desc: 'compte créé / compte suspendu' },
    { title: 'UID Facebook', desc: 'Identifiant utilisateur Facebook' },
    { title: 'Prénom', desc: 'Prénom généré' },
    { title: 'Nom', desc: 'Nom généré' },
    { title: 'Mot de passe', desc: 'Password distribué' },
    { title: 'Cookies', desc: 'Cookies complets' },
    { title: 'ID Telegram', desc: 'ID numérique de l’expéditeur' },
    { title: 'Username Telegram', desc: '@username' },
    { title: 'Notes', desc: 'Observations & proxy' }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white font-mono">
              Google Apps Script Backend (100% Gratuit)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Utilisez Google Sheets comme base de données cloud gratuite avec API REST webhook native.
            </p>
          </div>
        </div>

        <button
          onClick={handleCopyCode}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span>{copied ? 'Code Copié dans le presse-papier !' : 'Copier le Script Google'}</span>
        </button>
      </div>

      {/* Step by Step Setup Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <span className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center font-mono">1</span>
            <span>Créer la feuille</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Allez sur <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-blue-400 underline inline-flex items-center gap-0.5">sheets.new <ExternalLink className="h-3 w-3 inline" /></a> et nommez votre fichier <strong>"Taskify Pro DB"</strong>.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <span className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center font-mono">2</span>
            <span>Ouvrir Apps Script</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Dans le menu supérieur, cliquez sur <strong>Extensions &gt; Apps Script</strong>. Supprimez tout le texte et collez le script ci-dessous.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <span className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center font-mono">3</span>
            <span>Déployer en Web App</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Cliquez sur <strong>Déployer &gt; Nouveau déploiement</strong>. Sélectionnez <em>Application Web</em>, accès sur <strong>"Tout le monde"</strong> et copiez l'URL.
          </p>
        </div>
      </div>

      {/* Sheet Columns Preview */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <span>Structure automatique des colonnes créées par le script :</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {columns.map((col, idx) => (
            <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <div className="font-mono font-bold text-emerald-300 text-[11px] truncate">{col.title}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{col.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Code Viewer */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-emerald-400" />
            <span className="font-mono font-bold text-xs text-slate-200">Code.gs (Apps Script)</span>
          </div>
          <button
            onClick={handleCopyCode}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copié !' : 'Copier'}
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto leading-relaxed max-h-96 select-all">
          {appsScriptCode}
        </pre>
      </div>
    </div>
  );
};
