import React, { useEffect } from 'react';

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

type Action = 'balance' | 'tasks' | 'withdraw' | 'support' | 'referrals' | 'leaderboard' | 'language';

interface Props {
  onAction?: (action: Action) => void;
}

export default function TelegramMiniApp({ onAction }: Props) {
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;

    if (webApp) {
      webApp.ready();
      webApp.expand();
    }
  }, []);

  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;

  const firstName = user?.first_name || 'Utilisateur';

  const handleAction = (action: Action) => {
    const webApp = window.Telegram?.WebApp;

    try {
      webApp?.HapticFeedback?.impactOccurred('light');
    } catch {
      // Haptic non disponible
    }

    onAction?.(action);
  };

  const buttons: {
    action: Action;
    icon: string;
    title: string;
    subtitle: string;
    className: string;
  }[] = [
    {
      action: 'balance',
      icon: '💰',
      title: 'Solde',
      subtitle: 'Balance',
      className: 'tm-blue'
    },
    {
      action: 'tasks',
      icon: '📋',
      title: 'Tâches',
      subtitle: 'Tasks',
      className: 'tm-red'
    },
    {
      action: 'withdraw',
      icon: '🏦',
      title: 'Retrait',
      subtitle: 'Withdraw',
      className: 'tm-green'
    },
    {
      action: 'support',
      icon: '📞',
      title: 'Support',
      subtitle: 'Assistance',
      className: 'tm-cyan'
    },
    {
      action: 'referrals',
      icon: '👥',
      title: 'Parrainages',
      subtitle: 'Referrals',
      className: 'tm-purple'
    },
    {
      action: 'leaderboard',
      icon: '🏆',
      title: 'Classement',
      subtitle: 'Top opérateurs',
      className: 'tm-gold'
    }
  ];

  return (
    <div className="tm-app">
      <div className="tm-container">

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
              key={button.action}
              className={`tm-action ${button.className}`}
              onClick={() => handleAction(button.action)}
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
            className="tm-language"
            onClick={() => handleAction('language')}
          >
            <span>🪩</span>

            <div>
              <strong>Langue / Language</strong>
              <small>Français · English · Русский · Español</small>
            </div>

            <b>→</b>
          </button>

        </section>

        <footer className="tm-footer">
          <span>Taskify Pro</span>
          <span>•</span>
          <span>Telegram Mini App</span>
        </footer>

      </div>
    </div>
  );
}