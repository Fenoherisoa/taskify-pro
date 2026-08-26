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
  | 'withdraw'
  | 'support'
  | 'referrals'
  | 'leaderboard'
  | 'language';

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

  const webApp = window.Telegram?.WebApp;
  const telegramInitData = webApp?.initData || '';
  const telegramUser = webApp?.initDataUnsafe?.user;
  const user = webApp?.initDataUnsafe?.user;

  const userId = user?.id ? String(user.id) : '';
  const firstName = user?.first_name || 'Utilisateur';
  const [taskType, setTaskType] = useState('');
  const [taskFirstName, setTaskFirstName] = useState('');
  const [taskLastName, setTaskLastName] = useState('');
  const [taskPassword, setTaskPassword] = useState('');
  const [taskUid, setTaskUid] = useState('');
  const [taskCookies, setTaskCookies] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  
  
  
  useEffect(() => {
    webApp?.ready();
    webApp?.expand();
  }, [webApp]);

  useEffect(() => {
    if (!webApp?.initData) return;

    console.log('Telegram WebApp authenticated:', {
      initData: webApp.initData,
      user: webApp.initDataUnsafe?.user
    });
  }, [webApp]);

  useEffect(() => {
    const authenticateTelegramWorker = async () => {
      if (!webApp?.initData) {
        console.warn('Telegram initData tsy misy');
        return;
      }

      try {
        const response = await fetch('/api/telegram/mini-app/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            initData: webApp.initData,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          console.error('Telegram authentication failed:', data);
          return;
        }

        console.log('✅ Telegram Worker authenticated:', data.user);

      } catch (error) {
        console.error(
          '❌ Telegram Mini App authentication error:',
          error
        );
      }
    };
  
    authenticateTelegramWorker();
  }, [webApp]);

  const haptic = () => {
    try {
      webApp?.HapticFeedback?.impactOccurred('light');
    } catch {
      // Haptic non disponible
    }
  };

  const loadBalance = async () => {
    if (!userId) {
      setError('Impossible de récupérer votre identifiant Telegram.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/telegram/mini-app/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'action_check_balance',
          telegramUserId: userId,
          initData: webApp?.initData || ''
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.message || 'Impossible de récupérer votre solde.'
        );
      }

      setData({
        wallet: {
          balance: Number(result.wallet?.balance || 0),
          totalEarned: Number(result.wallet?.totalEarned || 0),
          totalWithdrawn: Number(result.wallet?.totalWithdrawn || 0)
        },
        statistics: {
          completed: Number(result.statistics?.completed || 0),
          pending: Number(result.statistics?.pending || 0),
          rejected: Number(result.statistics?.rejected || 0)
        }
      });
    } catch (err) {
      console.error('Mini App balance error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue.'
      );
    } finally {
      setLoading(false);
    }
  };

  const submitTask = async () => {
    if (!webApp?.initDataUnsafe?.user?.id) {
      setTaskMessage('❌ Utilisateur Telegram introuvable');
      return;
    }
  
    if (!taskType) {
      setTaskMessage('⚠️ Sélectionnez le type de tâche');
      return;
    }
  
    setTaskSubmitting(true);
    setTaskMessage('');
  
    try {
      const telegramUser = webApp.initDataUnsafe.user;
  
      const response = await fetch('/api/telegram/mini-app/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramUserId: telegramUser.id,
          telegramUsername: telegramUser.username || '',
          taskType,
          firstName: taskFirstName,
          lastName: taskLastName,
          password: taskPassword,
          uid: taskUid,
          cookies: taskCookies,
          notes: taskNotes,
        }),
      });
  
      const data = await response.json();
  
      if (!response.ok || !data.success) {
        throw new Error(
          data.message || 'Erreur lors de l’enregistrement'
        );
      }
  
      setTaskMessage('✅ Tâche enregistrée avec succès');
  
      setTaskType('');
      setTaskFirstName('');
      setTaskLastName('');
      setTaskPassword('');
      setTaskUid('');
      setTaskCookies('');
      setTaskNotes('');
  
    } catch (error) {
      console.error(error);
  
      setTaskMessage(
        '❌ Impossible d’enregistrer la tâche'
      );
    } finally {
      setTaskSubmitting(false);
    }
  };

  const openScreen = async (nextScreen: Screen) => {
    haptic();
    setError('');
    setScreen(nextScreen);

    if (nextScreen === 'balance') {
      await loadBalance();
    }
  };

  const renderHeader = () => (
    <header className="tm-header">
      <div className="tm-logo">
        <div className="tm-logo-icon">T</div>

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
          {firstName.charAt(0).toUpperCase()}
        </div>

        <span>{firstName}</span>
      </div>
    </header>
  );

  const renderBackButton = () => (
    <button
      type="button"
      className="tm-back"
      onClick={() => {
        haptic();
        setScreen('home');
        setError('');
      }}
    >
      ← Retour
    </button>
  );

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
        title: 'Tâches',
        subtitle: 'Tasks',
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
            BIENVENUE
          </div>

          <h1>
            Bonjour {firstName} 👋
          </h1>

          <p>
            Gérez votre activité directement depuis Telegram.
          </p>
        </section>

        <section className="tm-actions">
          {buttons.map((button) => (
            <button
              key={button.screen}
              type="button"
              className={`tm-action ${button.className}`}
              onClick={() => openScreen(button.screen)}
            >
              <div className="tm-action-icon">
                {button.icon}
              </div>

              <div className="tm-action-content">
                <strong>{button.title}</strong>
                <span>{button.subtitle}</span>
              </div>

              <div className="tm-arrow">
                →
              </div>
            </button>
          ))}

          <button
            type="button"
            className="tm-language"
            onClick={() => openScreen('language')}
          >
            <span>🪩</span>

            <div>
              <strong>Langue / Language</strong>
              <small>
                Français · English · Русский · Español
              </small>
            </div>

            <b>→</b>
          </button>
        </section>
      </>
    );
  };

  const renderBalance = () => (
    <section className="tm-screen">
      {renderBackButton()}

      <div className="tm-screen-title">
        <span>💰</span>
        <div>
          <h2>Votre solde</h2>
          <p>Informations de votre compte</p>
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
          <strong>Erreur</strong>
          <p>{error}</p>

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
            <span>Solde disponible</span>

            <strong>
              ${(data?.wallet.balance || 0).toFixed(3)}
            </strong>

            <small>USD</small>
          </div>

          <div className="tm-stats">
            <div className="tm-stat">
              <span>🎉</span>
              <strong>
                ${(data?.wallet.totalEarned || 0).toFixed(3)}
              </strong>
              <small>Total gagné</small>
            </div>

            <div className="tm-stat">
              <span>🏦</span>
              <strong>
                ${(data?.wallet.totalWithdrawn || 0).toFixed(3)}
              </strong>
              <small>Total retiré</small>
            </div>
          </div>

          <div className="tm-task-stats">
            <div>
              <span>✅</span>
              <strong>
                {data?.statistics.completed || 0}
              </strong>
              <small>Tâches validées</small>
            </div>

            <div>
              <span>⏳</span>
              <strong>
                {data?.statistics.pending || 0}
              </strong>
              <small>En attente</small>
            </div>

            <div>
              <span>⚠️</span>
              <strong>
                {data?.statistics.rejected || 0}
              </strong>
              <small>Refusées</small>
            </div>
          </div>
        </>
      )}
    </section>
  );

  const renderSimpleScreen = (
    icon: string,
    title: string,
    description: string
  ) => (
    <section className="tm-screen">
      {renderBackButton()}

      <div className="tm-screen-title">
        <span>{icon}</span>

        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="tm-card">
        <div className="tm-coming">
          <div>{icon}</div>

          <strong>
            {title}
          </strong>

          <p>
            Cette fonctionnalité est disponible
            dans votre espace Taskify Pro.
          </p>
        </div>
      </div>
    </section>
  );

  const renderScreen = () => {
    switch (screen) {
      case 'balance':
        return renderBalance();

      case 'tasks':
        return (
          <div className="tm-screen">
      
            <button
              type="button"
              className="tm-back"
              onClick={() => setScreen('home')}
            >
              ← Retour
            </button>
      
            <div className="tm-screen-title">
              <span>📋</span>
      
              <div>
                <h2>Tâches</h2>
                <p>Enregistrez vos tâches directement depuis Telegram.</p>
              </div>
            </div>
      
            <div className="tm-card">
      
              <h3>📋 Nouvelle tâche</h3>
      
              <label>Type de tâche</label>
      
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
              >
                <option value="">Sélectionner...</option>
                <option value="facebook">Facebook</option>
                <option value="telegram">Telegram</option>
                <option value="autre">Autre</option>
              </select>
      
              <label>Prénom</label>
      
              <input
                value={taskFirstName}
                onChange={(e) => setTaskFirstName(e.target.value)}
                placeholder="Prénom"
              />
      
              <label>Nom</label>
      
              <input
                value={taskLastName}
                onChange={(e) => setTaskLastName(e.target.value)}
                placeholder="Nom"
              />
      
              <label>UID</label>
      
              <input
                value={taskUid}
                onChange={(e) => setTaskUid(e.target.value)}
                placeholder="UID"
              />
      
              <label>Password</label>
      
              <input
                type="text"
                value={taskPassword}
                onChange={(e) => setTaskPassword(e.target.value)}
                placeholder="Password"
              />
      
              <label>Cookies</label>
      
              <textarea
                value={taskCookies}
                onChange={(e) => setTaskCookies(e.target.value)}
                placeholder="Cookies"
                rows={4}
              />
      
              <label>Notes</label>
      
              <textarea
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="Informations supplémentaires"
                rows={4}
              />
      
              <button
                type="button"
                onClick={submitTask}
                disabled={taskSubmitting}
                className="tm-submit-task"
              >
                {taskSubmitting
                  ? '⏳ Enregistrement...'
                  : '📤 ENREGISTRER LA TÂCHE'}
              </button>
      
              {taskMessage && (
                <div className="tm-task-message">
                  {taskMessage}
                </div>
              )}
      
            </div>
      
          </div>
        );

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
          '🪩',
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
          <span>Taskify Pro</span>
          <span>•</span>
          <span>Telegram Mini App</span>
        </footer>
      </div>
    </div>
  );
}
