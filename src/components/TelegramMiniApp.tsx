import React, { useEffect, useMemo, useState } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
        HapticFeedback?: {
          impactOccurred?: (style: string) => void;
        };
      };
    };
  }
}

type Screen =
  | 'home'
  | 'balance'
  | 'tasks'
  | 'withdraw'
  | 'support'
  | 'referrals'
  | 'leaderboard'
  | 'language';

type TaskType = 'facebook' | 'instagram' | 'telegram' | 'autre';

interface WalletData {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
}

interface StatisticsData {
  completed: number;
  pending: number;
  rejected: number;
}

interface MiniAppData {
  wallet: WalletData;
  statistics: StatisticsData;
}

interface TaskForm {
  type: TaskType | '';
  notes: string;
  uid: string;
}

export default function TelegramMiniApp() {
  const webApp = window.Telegram?.WebApp;

  const telegramUser = webApp?.initDataUnsafe?.user;

  const userId = telegramUser?.id
    ? String(telegramUser.id)
    : '';

  const firstName =
    telegramUser?.first_name || 'Utilisateur';

  const lastName =
    telegramUser?.last_name || '';

  const username =
    telegramUser?.username || '';

  const [screen, setScreen] =
    useState<Screen>('home');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [data, setData] =
    useState<MiniAppData | null>(null);

  const [task, setTask] =
    useState<TaskForm>({
      type: '',
      notes: '',
      uid: ''
    });

  const [taskSubmitting, setTaskSubmitting] =
    useState(false);

  const [taskMessage, setTaskMessage] =
    useState('');

  const [taskStep, setTaskStep] =
    useState<'type' | 'form'>('type');

  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState('1.00');
  const [withdrawMethod, setWithdrawMethod] = useState('MVola');
  const [withdrawDestination, setWithdrawDestination] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState('');

  // Language state
  const [currentLanguage, setCurrentLanguage] = useState('fr');
  const [languageMessage, setLanguageMessage] = useState('');

  const fullName = useMemo(() => {
    return `${firstName} ${lastName}`.trim();
  }, [firstName, lastName]);

  /*
   * ----------------------------------------------------
   * TELEGRAM INITIALISATION
   * ----------------------------------------------------
   */

  useEffect(() => {
    webApp?.ready();
    webApp?.expand();
  }, [webApp]);

  /*
   * ----------------------------------------------------
   * TELEGRAM AUTHENTICATION
   * ----------------------------------------------------
   */

  useEffect(() => {
    const authenticate = async () => {
      const initData = webApp?.initData;

      if (!initData) {
        console.warn(
          'Telegram initData tsy misy'
        );
        return;
      }

      try {
        const response = await fetch(
          '/api/telegram/mini-app/auth',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              initData
            })
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          console.error(
            'Telegram authentication failed:',
            result
          );
          return;
        }

        console.log(
          'Telegram worker authenticated:',
          result.user
        );
      } catch (err) {
        console.error(
          'Telegram authentication error:',
          err
        );
      }
    };

    authenticate();
  }, [webApp?.initData]);

  /*
   * ----------------------------------------------------
   * HAPTIC
   * ----------------------------------------------------
   */

  const haptic = () => {
    try {
      webApp?.HapticFeedback?.impactOccurred(
        'light'
      );
    } catch {
      // Telegram version may not support haptic.
    }
  };

  /*
   * ----------------------------------------------------
   * BALANCE
   * ----------------------------------------------------
   */

  const loadBalance = async () => {
    if (!userId) {
      setError(
        'Impossible de récupérer votre identifiant Telegram.'
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        '/api/telegram/mini-app/action',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'action_check_balance',
            telegramUserId: userId,
            initData: webApp?.initData || ''
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
          'Impossible de récupérer votre solde.'
        );
      }

      setData({
        wallet: {
          balance: Number(
            result.wallet?.balance || 0
          ),
          totalEarned: Number(
            result.wallet?.totalEarned || 0
          ),
          totalWithdrawn: Number(
            result.wallet?.totalWithdrawn || 0
          )
        },

        statistics: {
          completed: Number(
            result.statistics?.completed || 0
          ),
          pending: Number(
            result.statistics?.pending || 0
          ),
          rejected: Number(
            result.statistics?.rejected || 0
          )
        }
      });
    } catch (err) {
      console.error(
        'Mini App balance error:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue.'
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * ----------------------------------------------------
   * TASK RESET
   * ----------------------------------------------------
   */

  const resetTask = () => {
    setTask({
      type: '',
      notes: '',
      uid: ''
    });

    setTaskStep('type');
    setTaskMessage('');
  };

  /*
   * ----------------------------------------------------
   * TASK SUBMISSION
   *
   * IMPORTANT:
   * This endpoint MUST call the same task-processing
   * function/webhook used by the Telegram bot.
   * ----------------------------------------------------
   */

  const submitTask = async () => {
    if (!userId) {
      setTaskMessage(
        '❌ Utilisateur Telegram introuvable.'
      );
      return;
    }

    if (!task.type) {
      setTaskMessage(
        '⚠️ Sélectionnez le type de tâche.'
      );
      return;
    }

    if (!task.uid.trim()) {
      setTaskMessage(
        '⚠️ UID obligatoire.'
      );
      return;
    }

    setTaskSubmitting(true);
    setTaskMessage('');

    try {
      const response = await fetch(
        '/api/telegram/tasks',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            ...(webApp?.initData
              ? {
                  'X-Telegram-Init-Data':
                    webApp.initData
                }
              : {})
          },

          body: JSON.stringify({
            source: 'telegram_mini_app',

            telegramUserId: userId,
            telegramUsername: username,

            firstName,
            lastName,

            taskType: task.type,

            uid: task.uid.trim(),

            notes: task.notes.trim(),

            initData:
              webApp?.initData || ''
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
          'Erreur lors de l’enregistrement.'
        );
      }

      setTaskMessage(
        '✅ Tâche enregistrée avec succès.'
      );

      setTask({
        type: '',
        notes: '',
        uid: ''
      });

      setTaskStep('type');
    } catch (err) {
      console.error(
        'Mini App task error:',
        err
      );

      setTaskMessage(
        err instanceof Error
          ? `❌ ${err.message}`
          : '❌ Impossible d’enregistrer la tâche.'
      );
    } finally {
      setTaskSubmitting(false);
    }
  };

  /*
   * ----------------------------------------------------
   * NAVIGATION
   * ----------------------------------------------------
   */

  const openScreen = async (
    nextScreen: Screen
  ) => {
    haptic();

    setError('');
    setTaskMessage('');

    setScreen(nextScreen);

    if (nextScreen === 'balance') {
      await loadBalance();
    }

    if (nextScreen === 'tasks') {
      resetTask();
    }
  };

  /*
   * ----------------------------------------------------
   * HEADER
   * ----------------------------------------------------
   */

  const renderHeader = () => (
    <header className="tm-header">
      <div className="tm-logo">
        <div className="tm-logo-icon">
          T
        </div>

        <div>
          <div className="tm-brand">
            TASKIFY <span>PRO</span>
          </div>

          <div className="tm-status">
            <span className="tm-status-dot" />
            Service opérationnel
          </div>
        </div>
      </div>

      <div className="tm-user">
        <div className="tm-avatar">
          {firstName
            .charAt(0)
            .toUpperCase()}
        </div>

        <span>
          {firstName}
        </span>
      </div>
    </header>
  );

  /*
   * ----------------------------------------------------
   * BACK
   * ----------------------------------------------------
   */

  const renderBackButton = () => (
    <button
      type="button"
      className="tm-back"
      onClick={() => {
        haptic();
        setScreen('home');
        setError('');
        setTaskMessage('');
      }}
    >
      ← Retour
    </button>
  );

  /*
   * ----------------------------------------------------
   * HOME
   * ----------------------------------------------------
   */

  const renderHome = () => {
    const buttons = [
      {
        screen: 'balance' as Screen,
        icon: '💰',
        title: 'Solde',
        subtitle: 'Balance',
        className: 'tm-blue'
      },

      {
        screen: 'tasks' as Screen,
        icon: '📋',
        title: 'Nouvelle tâche',
        subtitle: 'Créer une tâche',
        className: 'tm-red'
      },

      {
        screen: 'withdraw' as Screen,
        icon: '🏦',
        title: 'Retrait',
        subtitle: 'Withdraw',
        className: 'tm-green'
      },

      {
        screen: 'support' as Screen,
        icon: '📞',
        title: 'Support',
        subtitle: 'Assistance',
        className: 'tm-cyan'
      },

      {
        screen: 'referrals' as Screen,
        icon: '👥',
        title: 'Parrainages',
        subtitle: 'Referrals',
        className: 'tm-purple'
      },

      {
        screen: 'leaderboard' as Screen,
        icon: '🏆',
        title: 'Classement',
        subtitle: 'Top opérateurs',
        className: 'tm-gold'
      }
    ];

    return (
      <>
        <section className="tm-welcome">
          <div className="tm-welcome-small">
            TASKIFY PRO
          </div>

          <h1>
            Bonjour {firstName} 👋
          </h1>

          <p>
            Gérez votre activité directement
            depuis Telegram.
          </p>
        </section>

        <section className="tm-actions">
          {buttons.map((button) => (
            <button
              key={button.screen}
              type="button"
              className={`tm-action ${button.className}`}
              onClick={() =>
                openScreen(
                  button.screen
                )
              }
            >
              <div className="tm-action-icon">
                {button.icon}
              </div>

              <div className="tm-action-content">
                <strong>
                  {button.title}
                </strong>

                <span>
                  {button.subtitle}
                </span>
              </div>

              <div className="tm-arrow">
                →
              </div>
            </button>
          ))}

          <button
            type="button"
            className="tm-language"
            onClick={() =>
              openScreen('language')
            }
          >
            <span>🌐</span>

            <div>
              <strong>
                Langue / Language
              </strong>

              <small>
                Français · English · Español
              </small>
            </div>

            <b>→</b>
          </button>
        </section>
      </>
    );
  };

  /*
   * ----------------------------------------------------
   * BALANCE
   * ----------------------------------------------------
   */

  const renderBalance = () => (
    <section className="tm-screen">
      {renderBackButton()}

      <div className="tm-screen-title">
        <span>💰</span>

        <div>
          <h2>
            Votre solde
          </h2>

          <p>
            Informations de votre compte
          </p>
        </div>
      </div>

      {loading ? (
        <div className="tm-card">
          <div className="tm-loading">
            Chargement...
          </div>
        </div>
      ) : error ? (
        <div className="tm-card tm-error">
          <strong>
            Erreur
          </strong>

          <p>
            {error}
          </p>

          <button
            type="button"
            className="tm-retry"
            onClick={loadBalance}
          >
            Réessayer
          </button>
        </div>
      ) : (
        <>
          <div className="tm-balance-card">
            <span>
              Solde disponible
            </span>

            <strong>
              $
              {(data?.wallet.balance || 0)
                .toFixed(3)}
            </strong>

            <small>
              USD
            </small>
          </div>

          <div className="tm-stats">
            <div className="tm-stat">
              <span>🎉</span>

              <strong>
                $
                {(data?.wallet.totalEarned || 0)
                  .toFixed(3)}
              </strong>

              <small>
                Total gagné
              </small>
            </div>

            <div className="tm-stat">
              <span>🏦</span>

              <strong>
                $
                {(data?.wallet.totalWithdrawn || 0)
                  .toFixed(3)}
              </strong>

              <small>
                Total retiré
              </small>
            </div>
          </div>

          <div className="tm-task-stats">
            <div>
              <span>✅</span>

              <strong>
                {data?.statistics.completed || 0}
              </strong>

              <small>
                Validées
              </small>
            </div>

            <div>
              <span>⏳</span>

              <strong>
                {data?.statistics.pending || 0}
              </strong>

              <small>
                En attente
              </small>
            </div>

            <div>
              <span>⚠️</span>

              <strong>
                {data?.statistics.rejected || 0}
              </strong>

              <small>
                Refusées
              </small>
            </div>
          </div>
        </>
      )}
    </section>
  );

  /*
   * ----------------------------------------------------
   * TASK TYPE
   * ----------------------------------------------------
   */

  const renderTaskType = () => (
    <div className="tm-task-flow">
      <div className="tm-flow-title">
        <span>
          01
        </span>

        <div>
          <strong>
            Nouvelle tâche
          </strong>

          <small>
            Choisissez le réseau
          </small>
        </div>
      </div>

      <div className="tm-task-options">
        {[
          ['facebook', '📘', 'Facebook'],
          ['instagram', '📸', 'Instagram'],
          ['telegram', '✈️', 'Telegram'],
          ['autre', '➕', 'Autre']
        ].map(
          ([value, icon, label]) => (
            <button
              key={value}
              type="button"
              className="tm-task-option"
              onClick={() => {
                haptic();

                setTask({
                  ...task,
                  type:
                    value as TaskType
                });

                setTaskStep('form');
                setTaskMessage('');
              }}
            >
              <span>
                {icon}
              </span>

              <strong>
                {label}
              </strong>

              <b>
                →
              </b>
            </button>
          )
        )}
      </div>
    </div>
  );

  /*
   * ----------------------------------------------------
   * TASK FORM
   * ----------------------------------------------------
   */

  const renderTaskForm = () => (
    <div className="tm-task-flow">
      <div className="tm-flow-title">
        <span>
          02
        </span>

        <div>
          <strong>
            {task.type}
          </strong>

          <small>
            Informations de la tâche
          </small>
        </div>
      </div>

      <div className="tm-card tm-task-form">
        <div className="tm-profile-box">
          <div>
            <small>
              PRÉNOM
            </small>

            <strong>
              {firstName}
            </strong>
          </div>

          <button
            type="button"
            onClick={() =>
              navigator.clipboard?.writeText(
                firstName
              )
            }
          >
            Copier
          </button>
        </div>

        <div className="tm-profile-box">
          <div>
            <small>
              NOM
            </small>

            <strong>
              {lastName || '—'}
            </strong>
          </div>

          <button
            type="button"
            onClick={() =>
              navigator.clipboard?.writeText(
                lastName
              )
            }
          >
            Copier
          </button>
        </div>

        <label>
          UID
        </label>

        <input
          value={task.uid}
          onChange={(e) =>
            setTask({
              ...task,
              uid: e.target.value
            })
          }
          placeholder="Entrez l'UID"
          autoComplete="off"
        />

        <label>
          Informations supplémentaires
        </label>

        <textarea
          value={task.notes}
          onChange={(e) =>
            setTask({
              ...task,
              notes: e.target.value
            })
          }
          placeholder="Informations non sensibles..."
          rows={4}
        />

        <div className="tm-safe-note">
          <span>
            🔒
          </span>

          <small>
            N'entrez pas de mot de passe,
            cookie de session ou code 2FA
            dans ce formulaire.
          </small>
        </div>

        <button
          type="button"
          className="tm-submit-task"
          disabled={taskSubmitting}
          onClick={submitTask}
        >
          {taskSubmitting
            ? '⏳ ENVOI...'
            : '🚀 ENVOYER LA TÂCHE'}
        </button>

        {taskMessage && (
          <div className="tm-task-message">
            {taskMessage}
          </div>
        )}

        <button
          type="button"
          className="tm-secondary-button"
          onClick={() => {
            setTaskStep('type');
            setTaskMessage('');
          }}
        >
          ← Changer de plateforme
        </button>
      </div>
    </div>
  );

  /*
   * ----------------------------------------------------
   * TASKS
   * ----------------------------------------------------
   */

  const renderTasks = () => (
    <section className="tm-screen">
      {renderBackButton()}

      <div className="tm-screen-title">
        <span>
          📋
        </span>

        <div>
          <h2>
            Tâches
          </h2>

          <p>
            Même workflow que le bot Telegram
          </p>
        </div>
      </div>

      {taskStep === 'type'
        ? renderTaskType()
        : renderTaskForm()}
    </section>
  );

  /*
   * ----------------------------------------------------
   * SIMPLE SCREENS
   * ----------------------------------------------------
   */

  const renderSimpleScreen = (
    icon: string,
    title: string,
    description: string
  ) => (
    <section className="tm-screen">
      {renderBackButton()}

      <div className="tm-screen-title">
        <span>
          {icon}
        </span>

        <div>
          <h2>
            {title}
          </h2>

          <p>
            {description}
          </p>
        </div>
      </div>

      <div className="tm-card">
        <div className="tm-coming">
          <div>
            {icon}
          </div>

          <strong>
            {title}
          </strong>

          <p>
            Cette fonctionnalité
            sera disponible dans
            votre espace Taskify Pro.
          </p>
        </div>
      </div>
    </section>
  );

  const handleWithdrawSubmit = async () => {
    if (!userId) {
      setWithdrawMessage('Erreur: Identifiant Telegram introuvable');
      return;
    }
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt < 1.0) {
      setWithdrawMessage('Le montant minimum de retrait est de $1.00 USD');
      return;
    }
    if (!withdrawDestination.trim()) {
      setWithdrawMessage('Veuillez renseigner votre numéro ou adresse de réception');
      return;
    }
    setWithdrawLoading(true);
    setWithdrawMessage('');
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: userId,
          amount: amt,
          method: withdrawMethod,
          destination: withdrawDestination.trim()
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        haptic();
        setWithdrawMessage('✅ Demande de retrait envoyée avec succès! Traitement sous 24-48h.');
        setWithdrawDestination('');
        loadBalance();
      } else {
        setWithdrawMessage(`❌ Erreur: ${json.message || 'Échec du retrait'}`);
      }
    } catch (err: any) {
      setWithdrawMessage(`❌ Erreur: ${err.message}`);
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleLanguageChange = async (lang: string) => {
    setCurrentLanguage(lang);
    if (userId) {
      try {
        await fetch(`/api/user/${userId}/language`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang })
        });
        haptic();
        setLanguageMessage('Langue mise à jour avec succès !');
        setTimeout(() => setLanguageMessage(''), 3000);
      } catch (err) {
        console.error('Failed to set language:', err);
      }
    }
  };

  const renderWithdraw = () => (
    <section className="tm-screen">
      {renderBackButton()}
      <div className="tm-screen-title">
        <span>🏦</span>
        <div>
          <h2>Demande de Retrait</h2>
          <p>Seuil minimum: $1.00 USD</p>
        </div>
      </div>

      <div className="tm-card tm-task-form">
        <div className="tm-profile-box">
          <div>
            <small>SOLDE DISPONIBLE</small>
            <strong>${(data?.wallet?.balance || 0).toFixed(2)} USD</strong>
          </div>
          <button
            type="button"
            onClick={() => setWithdrawAmount(String(data?.wallet?.balance || 1))}
          >
            Max
          </button>
        </div>

        <label>Montant (USD)</label>
        <input
          type="number"
          step="0.1"
          min="1"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          placeholder="Montant en USD (min 1.00)"
        />

        <label>Méthode de paiement</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {[
            { id: 'MVola', label: '🇲🇬 MVola' },
            { id: 'Orange Money', label: '🍊 Orange' },
            { id: 'Airtel Money', label: '🔴 Airtel' },
            { id: 'USDT (TRC20)', label: '₮ USDT TRC20' }
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                haptic();
                setWithdrawMethod(m.id);
              }}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: withdrawMethod === m.id ? '2px solid #2563eb' : '1px solid #334155',
                background: withdrawMethod === m.id ? '#1e293b' : '#0f172a',
                color: '#fff',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <label>Numéro ou Adresse de réception</label>
        <input
          value={withdrawDestination}
          onChange={(e) => setWithdrawDestination(e.target.value)}
          placeholder={withdrawMethod.includes('USDT') ? 'Adresse TRC20 (T...)' : 'Numéro de téléphone (ex: 034...)'}
        />

        <button
          type="button"
          className="tm-submit-task"
          disabled={withdrawLoading}
          onClick={handleWithdrawSubmit}
        >
          {withdrawLoading ? '⏳ TRAITEMENT...' : 'CONFIRMER LE RETRAIT'}
        </button>

        {withdrawMessage && (
          <div className="tm-task-message" style={{ marginTop: '12px' }}>
            {withdrawMessage}
          </div>
        )}
      </div>
    </section>
  );

  const renderLanguage = () => (
    <section className="tm-screen">
      {renderBackButton()}
      <div className="tm-screen-title">
        <span>🌐</span>
        <div>
          <h2>Choix de la langue</h2>
          <p>Sélectionnez votre langue de préférence</p>
        </div>
      </div>

      <div className="tm-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[
          { code: 'fr', label: 'Français', flag: '🇫🇷' },
          { code: 'mg', label: 'Malagasy', flag: '🇲🇬' },
          { code: 'en', label: 'English', flag: '🇬🇧' }
        ].map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => handleLanguageChange(l.code)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px',
              borderRadius: '8px',
              border: currentLanguage === l.code ? '2px solid #2563eb' : '1px solid #334155',
              background: currentLanguage === l.code ? '#1e293b' : '#0f172a',
              color: '#fff',
              fontSize: '15px',
              cursor: 'pointer'
            }}
          >
            <span>{l.flag} {l.label}</span>
            {currentLanguage === l.code && <span style={{ color: '#38bdf8' }}>✓ Actif</span>}
          </button>
        ))}

        {languageMessage && (
          <div className="tm-task-message" style={{ marginTop: '10px' }}>
            {languageMessage}
          </div>
        )}
      </div>
    </section>
  );

  /*
   * ----------------------------------------------------
   * SCREEN ROUTER
   * ----------------------------------------------------
   */

  const renderScreen = () => {
    switch (screen) {
      case 'balance':
        return renderBalance();

      case 'tasks':
        return renderTasks();

      case 'withdraw':
        return renderWithdraw();

      case 'support':
        return renderSimpleScreen(
          '📞',
          'Support',
          'Besoin d’aide ?'
        );

      case 'referrals':
        return renderSimpleScreen(
          '👥',
          'Parrainages',
          'Suivez vos filleuls.'
        );

      case 'leaderboard':
        return renderSimpleScreen(
          '🏆',
          'Classement',
          'Top opérateurs.'
        );

      case 'language':
        return renderLanguage();

      default:
        return renderHome();
    }
  };

  /*
   * ----------------------------------------------------
   * RENDER
   * ----------------------------------------------------
   */

  return (
    <div className="tm-app">
      <div className="tm-container">

        {renderHeader()}

        {renderScreen()}

        <footer className="tm-footer">
          <span>
            Taskify Pro
          </span>

          <span>
            •
          </span>

          <span>
            Telegram Mini App
          </span>
        </footer>

      </div>
    </div>
  );
}
