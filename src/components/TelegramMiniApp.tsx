import React, { useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        HapticFeedback?: {
          impactOccurred: (style: string) => void;
        };
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
      };
    };
  }
}

type Screen =
  | 'home'
  | 'balance'
  | 'tasks'
  | 'taskType'
  | 'taskMethod'
  | 'taskForm'
  | 'withdraw'
  | 'support'
  | 'referrals'
  | 'leaderboard'
  | 'language';

type TaskType =
  | 'facebook'
  | 'instagram'
  | 'telegram'
  | 'autre';

type TaskMethod =
  | 'cookies'
  | '2fa';

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

export default function TelegramMiniApp() {
  const [screen, setScreen] = useState<Screen>('home');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<MiniAppData | null>(null);

  const [taskType, setTaskType] = useState<TaskType | ''>('');
  const [taskMethod, setTaskMethod] = useState<TaskMethod | ''>('');

  const [taskFirstName, setTaskFirstName] = useState('');
  const [taskLastName, setTaskLastName] = useState('');
  const [taskUid, setTaskUid] = useState('');
  const [taskNotes, setTaskNotes] = useState('');

  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskMessage, setTaskMessage] = useState('');

  const webApp = window.Telegram?.WebApp;
  const telegramUser = webApp?.initDataUnsafe?.user;

  const userId = telegramUser?.id
    ? String(telegramUser.id)
    : '';

  const firstName =
    telegramUser?.first_name || 'Utilisateur';

  /*
   * Telegram WebApp initialization
   */
  useEffect(() => {
    if (!webApp) {
      return;
    }

    webApp.ready();
    webApp.expand();
  }, [webApp]);

  /*
   * Telegram authentication
   */
  useEffect(() => {
    const authenticateTelegramWorker = async () => {
      if (!webApp?.initData) {
        console.warn('Telegram initData tsy misy');
        return;
      }

      try {
        const response = await fetch(
          '/api/telegram/mini-app/auth',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              initData: webApp.initData,
            }),
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
          '✅ Telegram Worker authenticated:',
          result.user
        );
      } catch (err) {
        console.error(
          '❌ Telegram authentication error:',
          err
        );
      }
    };

    authenticateTelegramWorker();
  }, [webApp]);

  /*
   * Haptic
   */
  const haptic = () => {
    try {
      webApp?.HapticFeedback?.impactOccurred('light');
    } catch {
      // Telegram version without haptic support
    }
  };

  /*
   * Balance
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
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'action_check_balance',
            telegramUserId: userId,
            initData: webApp?.initData || '',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Erreur serveur: ${response.status}`
        );
      }

      const result = await response.json();

      if (!result.success) {
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
          ),
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
          ),
        },
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
   * Submit task
   *
   * Les secrets d'authentification ne sont pas collectés.
   * On envoie uniquement les informations nécessaires
   * et non sensibles.
   */
  const submitTask = async () => {
    if (!webApp?.initData) {
      setTaskMessage(
        '❌ Cette application doit être ouverte depuis Telegram.'
      );
      return;
    }

    if (!userId) {
      setTaskMessage(
        '❌ Utilisateur Telegram introuvable.'
      );
      return;
    }

    if (!taskType) {
      setTaskMessage(
        '⚠️ Sélectionnez le type de tâche.'
      );
      return;
    }

    if (!taskMethod) {
      setTaskMessage(
        '⚠️ Sélectionnez le mode de traitement.'
      );
      return;
    }

    if (!taskFirstName.trim()) {
      setTaskMessage(
        '⚠️ Le prénom est obligatoire.'
      );
      return;
    }

    if (!taskLastName.trim()) {
      setTaskMessage(
        '⚠️ Le nom est obligatoire.'
      );
      return;
    }

    if (!taskUid.trim()) {
      setTaskMessage(
        '⚠️ Le UID est obligatoire.'
      );
      return;
    }

    setTaskSubmitting(true);
    setTaskMessage('');

    try {
      const response = await fetch(
        '/api/telegram/mini-app/tasks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            telegramUserId: userId,
            telegramUsername:
              telegramUser?.username || '',

            taskType,
            taskMethod,

            firstName: taskFirstName.trim(),
            lastName: taskLastName.trim(),
            uid: taskUid.trim(),
            notes: taskNotes.trim(),

            initData: webApp.initData,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            'Erreur lors de l’enregistrement.'
        );
      }

      haptic();

      setTaskMessage(
        '✅ Tâche enregistrée avec succès.'
      );

      setTimeout(() => {
        setTaskType('');
        setTaskMethod('');
        setTaskFirstName('');
        setTaskLastName('');
        setTaskUid('');
        setTaskNotes('');
        setTaskMessage('');
        setScreen('tasks');
      }, 1200);
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
   * Navigation
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
  };

  /*
   * Header
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
   * Back button
   */
  const renderBackButton = (
    target: Screen = 'home'
  ) => (
    <button
      type="button"
      className="tm-back"
      onClick={() => {
        haptic();
        setError('');
        setTaskMessage('');
        setScreen(target);
      }}
    >
      ← Retour
    </button>
  );

  /*
   * HOME
   */
  const renderHome = () => {
    const buttons = [
      {
        screen: 'balance' as Screen,
        icon: '💰',
        title: 'Solde',
        subtitle: 'Balance',
        className: 'tm-blue',
      },
      {
        screen: 'tasks' as Screen,
        icon: '📋',
        title: 'Tâches',
        subtitle: 'Nouvelle tâche',
        className: 'tm-red',
      },
      {
        screen: 'withdraw' as Screen,
        icon: '🏦',
        title: 'Retrait',
        subtitle: 'Withdraw',
        className: 'tm-green',
      },
      {
        screen: 'support' as Screen,
        icon: '📞',
        title: 'Support',
        subtitle: 'Assistance',
        className: 'tm-cyan',
      },
      {
        screen: 'referrals' as Screen,
        icon: '👥',
        title: 'Parrainages',
        subtitle: 'Referrals',
        className: 'tm-purple',
      },
      {
        screen: 'leaderboard' as Screen,
        icon: '🏆',
        title: 'Classement',
        subtitle: 'Top opérateurs',
        className: 'tm-gold',
      },
    ];

    return (
      <>
        <section className="tm-welcome">
          <div className="tm-welcome-small">
            BIENVENUE
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
                openScreen(button.screen)
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
                Français · Malagasy · English
              </small>
            </div>

            <b>→</b>
          </button>
        </section>
      </>
    );
  };

  /*
   * BALANCE
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
            Chargement de votre solde...
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
            🔄 Réessayer
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
              {(
                data?.wallet.balance || 0
              ).toFixed(3)}
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
                {(
                  data?.wallet.totalEarned || 0
                ).toFixed(3)}
              </strong>

              <small>
                Total gagné
              </small>
            </div>

            <div className="tm-stat">
              <span>🏦</span>

              <strong>
                $
                {(
                  data?.wallet.totalWithdrawn || 0
                ).toFixed(3)}
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
                {data?.statistics.completed ||
                  0}
              </strong>

              <small>
                Tâches validées
              </small>
            </div>

            <div>
              <span>⏳</span>

              <strong>
                {data?.statistics.pending ||
                  0}
              </strong>

              <small>
                En attente
              </small>
            </div>

            <div>
              <span>⚠️</span>

              <strong>
                {data?.statistics.rejected ||
                  0}
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
   * TASK HOME
   */
  const renderTasks = () => (
    <section className="tm-screen">
      {renderBackButton()}

      <div className="tm-screen-title">
        <span>📋</span>

        <div>
          <h2>
            Tâches
          </h2>

          <p>
            Gérez vos tâches depuis Telegram.
          </p>
        </div>
      </div>

      <div className="tm-card">
        <button
          type="button"
          className="tm-action tm-red"
          onClick={() => {
            haptic();
            setTaskMessage('');
            setScreen('taskType');
          }}
        >
          <div className="tm-action-icon">
            ➕
          </div>

          <div className="tm-action-content">
            <strong>
              COMMENCER UNE NOUVELLE TÂCHE
            </strong>

            <span>
              Créer une nouvelle tâche
            </span>
          </div>

          <div className="tm-arrow">
            →
          </div>
        </button>
      </div>
    </section>
  );

  /*
   * TASK TYPE
   */
  const renderTaskType = () => (
    <section className="tm-screen">
      {renderBackButton('tasks')}

      <div className="tm-screen-title">
        <span>📋</span>

        <div>
          <h2>
            Nouvelle tâche
          </h2>

          <p>
            Choisissez le service
          </p>
        </div>
      </div>

      <div className="tm-card">
        <h3>
          Sélectionnez le type de tâche
        </h3>

        <div className="tm-task-options">
          {[
            {
              value: 'facebook' as TaskType,
              icon: '🔵',
              label: 'Facebook',
            },
            {
              value: 'instagram' as TaskType,
              icon: '🟣',
              label: 'Instagram',
            },
            {
              value: 'telegram' as TaskType,
              icon: '🔷',
              label: 'Telegram',
            },
            {
              value: 'autre' as TaskType,
              icon: '⚪',
              label: 'Autre',
            },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              className="tm-task-option"
              onClick={() => {
                haptic();
                setTaskType(item.value);
                setTaskMethod('');
                setScreen('taskMethod');
              }}
            >
              <span>
                {item.icon}
              </span>

              <strong>
                {item.label}
              </strong>

              <b>
                →
              </b>
            </button>
          ))}
        </div>
      </div>
    </section>
  );

  /*
   * TASK METHOD
   */
  const renderTaskMethod = () => (
    <section className="tm-screen">
      {renderBackButton('taskType')}

      <div className="tm-screen-title">
        <span>
          {taskType === 'facebook'
            ? '🔵'
            : taskType === 'instagram'
            ? '🟣'
            : taskType === 'telegram'
            ? '🔷'
            : '⚪'}
        </span>

        <div>
          <h2>
            {taskType
              ? taskType.charAt(0).toUpperCase() +
                taskType.slice(1)
              : 'Tâche'}
          </h2>

          <p>
            Choisissez le mode
          </p>
        </div>
      </div>

      <div className="tm-card">
        <h3>
          Sélectionnez le mode
        </h3>

        <div className="tm-task-options">
          <button
            type="button"
            className="tm-task-option"
            onClick={() => {
              haptic();
              setTaskMethod('cookies');
              setScreen('taskForm');
            }}
          >
            <span>
              🍪
            </span>

            <div>
              <strong>
                Cookies
              </strong>

              <small>
                Mode Cookies
              </small>
            </div>

            <b>
              →
            </b>
          </button>

          <button
            type="button"
            className="tm-task-option"
            onClick={() => {
              haptic();
              setTaskMethod('2fa');
              setScreen('taskForm');
            }}
          >
            <span>
              🔐
            </span>

            <div>
              <strong>
                2FA
              </strong>

              <small>
                Mode 2FA
              </small>
            </div>

            <b>
              →
            </b>
          </button>
        </div>
      </div>
    </section>
  );

  /*
   * TASK FORM
   */
  const renderTaskForm = () => (
    <section className="tm-screen">
      {renderBackButton('taskMethod')}

      <div className="tm-screen-title">
        <span>📝</span>

        <div>
          <h2>
            Informations
          </h2>

          <p>
            Complétez les informations de la tâche
          </p>
        </div>
      </div>

      <div className="tm-card tm-task-form">
        <div className="tm-selected-task">
          <span>
            Service
          </span>

          <strong>
            {taskType
              ? taskType.charAt(0).toUpperCase() +
                taskType.slice(1)
              : '-'}
          </strong>
        </div>

        <div className="tm-selected-task">
          <span>
            Mode
          </span>

          <strong>
            {taskMethod === 'cookies'
              ? '🍪 Cookies'
              : '🔐 2FA'}
          </strong>
        </div>

        <label>
          Prénom
        </label>

        <input
          value={taskFirstName}
          onChange={(e) =>
            setTaskFirstName(e.target.value)
          }
          placeholder="Prénom"
          autoComplete="off"
        />

        <label>
          Nom
        </label>

        <input
          value={taskLastName}
          onChange={(e) =>
            setTaskLastName(e.target.value)
          }
          placeholder="Nom"
          autoComplete="off"
        />

        <label>
          UID
        </label>

        <input
          value={taskUid}
          onChange={(e) =>
            setTaskUid(e.target.value)
          }
          placeholder="UID"
          autoComplete="off"
        />

        <label>
          Informations supplémentaires
        </label>

        <textarea
          value={taskNotes}
          onChange={(e) =>
            setTaskNotes(e.target.value)
          }
          placeholder="Ajoutez les informations nécessaires..."
          rows={5}
        />

        <div className="tm-security-notice">
          🔒 Ne saisissez pas de mot de passe,
          cookie de session ou code 2FA dans ce
          formulaire.
        </div>

        <button
          type="button"
          className="tm-submit-task"
          onClick={submitTask}
          disabled={taskSubmitting}
        >
          {taskSubmitting
            ? '⏳ Enregistrement...'
            : '📤 ENVOYER LA TÂCHE'}
        </button>

        {taskMessage && (
          <div
            className={
              taskMessage.startsWith('✅')
                ? 'tm-task-message tm-success'
                : 'tm-task-message tm-error-message'
            }
          >
            {taskMessage}
          </div>
        )}
      </div>
    </section>
  );

  /*
   * SIMPLE SCREEN
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
            Cette fonctionnalité est
            disponible dans votre espace
            Taskify Pro.
          </p>
        </div>
      </div>
    </section>
  );

  /*
   * SCREEN ROUTER
   */
  const renderScreen = () => {
    switch (screen) {
      case 'balance':
        return renderBalance();

      case 'tasks':
        return renderTasks();

      case 'taskType':
        return renderTaskType();

      case 'taskMethod':
        return renderTaskMethod();

      case 'taskForm':
        return renderTaskForm();

      case 'withdraw':
        return renderSimpleScreen(
          '🏦',
          'Retrait',
          'Demandez votre paiement.'
        );

      case 'support':
        return renderSimpleScreen(
          '📞',
          'Support',
          'Besoin d’aide ? Contactez le support.'
        );

      case 'referrals':
        return renderSimpleScreen(
          '👥',
          'Parrainages',
          'Suivez vos filleuls et vos commissions.'
        );

      case 'leaderboard':
        return renderSimpleScreen(
          '🏆',
          'Classement',
          'Découvrez le classement des opérateurs.'
        );

      case 'language':
        return renderSimpleScreen(
          '🌐',
          'Langue',
          'Choisissez votre langue.'
        );

      default:
        return renderHome();
    }
  };

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
