import React, { useState } from 'react';
import { 
  BookOpen, 
  Bot, 
  FileSpreadsheet, 
  Server, 
  Globe, 
  CheckCircle2, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck,
  Terminal,
  ArrowRight,
  Zap
} from 'lucide-react';

export const DeploymentTutorialView: React.FC = () => {
  const [activeStep, setActiveStep] = useState(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const steps = [
    {
      id: 1,
      title: 'Création du Bot Telegram (@BotFather)',
      icon: Bot,
      color: 'blue',
      desc: 'Obtenir votre TELEGRAM_BOT_TOKEN officiel gratuitement en 60 secondes.'
    },
    {
      id: 2,
      title: 'Google Sheets & Apps Script Webhook',
      icon: FileSpreadsheet,
      color: 'emerald',
      desc: 'Créer une base de données cloud gratuite avec API REST webhook.'
    },
    {
      id: 3,
      title: 'Hébergement Gratuit (Render / Railway / Vercel)',
      icon: Server,
      color: 'indigo',
      desc: 'Déployer votre bot et votre dashboard 24h/24 sans carte bancaire.'
    },
    {
      id: 4,
      title: 'Connexion Finale & Démarrage',
      icon: Zap,
      color: 'amber',
      desc: 'Tester le flux Telegram et surveiller les comptes suspendus en direct.'
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hero card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-950/50 via-slate-900 to-indigo-950/50 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white font-mono">
              Guide de Déploiement 100% GRATUIT
            </h2>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 0€ / Aucune carte de crédit requise à aucun moment
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 max-w-3xl leading-relaxed mt-2">
          Suivez ce tutoriel pas-à-pas pour mettre en ligne l'ensemble du système <strong>Taskify Pro (@TaskifyProBot)</strong> avec le bot Telegram, le tableau de bord de supervision et la base Google Sheets.
        </p>
      </div>

      {/* Step Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = activeStep === step.id;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                isActive
                  ? 'bg-slate-900 border-blue-500 ring-1 ring-blue-500/30 shadow-lg'
                  : 'bg-slate-950/60 border-slate-800 hover:bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {step.id}
                </span>
                <Icon className={`h-4 w-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
              </div>
              <div className="font-bold text-xs text-white truncate">{step.title}</div>
            </button>
          );
        })}
      </div>

      {/* Detailed Step Content Container */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        {/* STEP 1: BotFather */}
        {activeStep === 1 && (
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-400" />
                Étape 1 : Créer votre Bot sur Telegram via @BotFather
              </h3>
              <span className="text-xs px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 font-mono">
                Durée : 1 min
              </span>
            </div>

            <ol className="space-y-3.5 text-slate-300 list-decimal list-inside leading-relaxed">
              <li className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                Ouvrez Telegram et recherchez le bot officiel vérifié{' '}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 font-bold underline inline-flex items-center gap-0.5"
                >
                  @BotFather <ExternalLink className="h-3 w-3 inline" />
                </a>.
              </li>
              <li className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                Envoyez la commande :
                <div className="mt-1 flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800 font-mono text-emerald-400">
                  <span>/newbot</span>
                  <button onClick={() => handleCopy('/newbot', 'newbot')} className="text-slate-400 hover:text-white">
                    {copiedKey === 'newbot' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </li>
              <li className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                Donnez un nom d'affichage à votre bot (ex: <code>Taskify Pro</code>).
              </li>
              <li className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                Donnez un nom d'utilisateur unique se terminant par <code>bot</code> (ex: <code>TaskifyProBot</code>).
              </li>
              <li className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                @BotFather vous fournit alors votre <strong>HTTP API Token</strong> (ex: <code>7892104928:AAH...</code>).
                <div className="mt-2 text-xs text-amber-300 bg-amber-950/30 p-2 rounded border border-amber-500/30">
                  🔒 Conservez ce token précieusement. Vous le collerez dans l'onglet <strong>Paramètres Bot</strong> du tableau de bord ou dans vos variables d'environnement.
                </div>
              </li>
            </ol>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                <span>Passer à l'Étape 2 (Google Sheets)</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Google Sheets & Apps Script */}
        {activeStep === 2 && (
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                Étape 2 : Configurer Google Sheets & Déployer Apps Script
              </h3>
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                Durée : 2 min
              </span>
            </div>

            <ol className="space-y-3.5 text-slate-300 list-decimal list-inside leading-relaxed">
              <li className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                Créez une feuille Google Sheet vierge sur <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-blue-400 font-bold underline">sheets.new</a>.
              </li>
              <li className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                Dans le menu supérieur, cliquez sur <strong>Extensions &gt; Apps Script</strong>.
              </li>
              <li className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                Supprimez le code existant dans <code>Code.gs</code> et collez l'intégralité du script fourni dans l'onglet <strong>"Google Sheets (Apps Script)"</strong> de ce tableau de bord.
              </li>
              <li className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                Cliquez sur <strong>Déployer &gt; Nouveau déploiement</strong> :
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400 text-xs pl-2">
                  <li>Sélectionnez le type d'icône engrenage : <strong>Application Web</strong></li>
                  <li>Exécuter en tant que : <strong>Moi</strong></li>
                  <li>Qui a accès : <strong>Tout le monde (Anyone)</strong> <span className="text-amber-400 font-bold">(TRÈS IMPORTANT pour autoriser le bot à écrire)</span></li>
                </ul>
              </li>
              <li className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                Cliquez sur Déployer, accordez les autorisations Google standard et copiez l'<strong>URL de l'application Web</strong> (se termine par <code>/exec</code>).
              </li>
            </ol>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setActiveStep(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Retour
              </button>
              <button
                onClick={() => setActiveStep(3)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                <span>Passer à l'Étape 3 (Hébergement Gratuit)</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Free Hosting */}
        {activeStep === 3 && (
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Server className="h-5 w-5 text-indigo-400" />
                Étape 3 : Hébergement Gratuit (Render.com, Railway ou Vercel)
              </h3>
              <span className="text-xs px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                Durée : 3 min
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Render.com (Recommended Free) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Option 1 : Render.com (Recommandé)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">100% Free</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-400 leading-relaxed">
                  <li>Inscrivez-vous gratuitement sur <a href="https://render.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">render.com</a> avec GitHub ou email (sans CB).</li>
                  <li>Cliquez sur <strong>New + &gt; Web Service</strong>.</li>
                  <li>Liez votre dépôt GitHub du projet ou téléchargez les fichiers exportés.</li>
                  <li>
                    Paramètres :
                    <div className="font-mono text-[11px] bg-slate-900 p-2 rounded mt-1 text-slate-300 space-y-1">
                      <div>Build Command: <span className="text-emerald-400">npm run build</span></div>
                      <div>Start Command: <span className="text-emerald-400">npm start</span></div>
                    </div>
                  </li>
                  <li>Dans l'onglet <strong>Environment</strong>, ajoutez vos variables :
                    <div className="font-mono text-[10px] text-indigo-300 mt-1">
                      TELEGRAM_BOT_TOKEN<br />
                      GOOGLE_SHEET_WEBHOOK_URL<br />
                      DEFAULT_BOT_PASSWORD
                    </div>
                  </li>
                </ol>
              </div>

              {/* Option B: Railway or Vercel */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Option 2 : Railway / Vercel / VPS</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">Alternative</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Vous pouvez également exécuter le bot en mode standalone Node.js sur n'importe quel VPS ou hébergeur gratuit :
                </p>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                  <div>$ git clone &lt;votre-repo&gt;</div>
                  <div>$ npm install</div>
                  <div>$ node bot.js</div>
                </div>
                <p className="text-xs text-slate-400">
                  Le fichier standalone <code>bot.js</code> est directement disponible au téléchargement dans l'onglet <strong>Exporter Code</strong> !
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setActiveStep(2)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Retour
              </button>
              <button
                onClick={() => setActiveStep(4)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                <span>Passer à l'Étape 4 (Finalisation)</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Live Verification */}
        {activeStep === 4 && (
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                Étape 4 : Vérification Finale & Surveillance des Comptes
              </h3>
              <span className="text-xs px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono">
                Opérationnel
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-white text-sm">Contrôle qualité & flux standardisé :</h4>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Tapez <code>/start</code> sur Telegram : Le bot affiche le menu avec le choix pilote <strong>"Facebook"</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Cliquez sur <strong>"Cookies"</strong> : Le bot génère automatiquement Prénom & Nom, puis affiche le mot de passe dynamique et les boutons <em>"Envoie UID"</em> et <em>"Annulation processus"</em>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Envoyez l'UID puis les Cookies : Le bot confirme par <strong>"Tâche terminée"</strong> et la ligne s'inscrit instantanément dans votre Google Sheet et dans le tableau de bord !
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Surveillance des suspensions : Si un compte est bloqué, modifiez son statut en <strong>"Compte Suspendu"</strong> en 1 clic dans le tableau de bord pour garder une traçabilité rigoureuse.
                  </span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs block">Prêt à tester ?</span>
                <span className="text-xs text-slate-400">Lancez dès maintenant une simulation interactive dans l'onglet Démo.</span>
              </div>
              <button
                onClick={() => {
                  const simTab = document.querySelector('[data-tab="simulator"]') as HTMLElement;
                  if (simTab) simTab.click();
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow"
              >
                Tester dans le Simulateur
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
