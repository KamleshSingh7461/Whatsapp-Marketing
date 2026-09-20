import React from 'react';
import { Role, User } from '../types';
import { CURRENCIES, CurrencyCode } from '../lib/currency';
import { TabType } from './Sidebar';

// Titles match the sidebar labels so a page is called the same thing everywhere.
const TAB_TITLES: Record<TabType, { title: string; subtitle: string }> = {
  inbox: { title: 'Chats', subtitle: 'Customer conversations' },
  campaigns: { title: 'Broadcasts', subtitle: 'Send approved messages to many customers' },
  templates: { title: 'Templates', subtitle: 'Message formats approved by Meta' },
  contacts: { title: 'Contacts & CRM', subtitle: 'Your customers and their permissions' },
  automations: { title: 'Automations', subtitle: 'Replies sent automatically' },
  calls: { title: 'Call sheets', subtitle: 'Follow up with customers who tapped a button' },
  analytics: { title: 'Analytics', subtitle: 'Messages, replies and costs' },
  settings: { title: 'WABA Settings', subtitle: 'Team, billing and Meta connection' },
};

// Only the pages that show amounts of money need a currency choice.
const TABS_WITH_MONEY: TabType[] = ['analytics', 'campaigns', 'contacts'];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  MARKETER: 'Marketer',
  AGENT: 'Support agent',
  VIEWER: 'Viewer',
};

const CURRENCY_CODES: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP'];

const Icon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

interface HeaderProps {
  activeTab?: TabType;
  user: User | null;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  notificationsEnabled?: boolean;
  onRequestNotificationPermission?: () => void;
  onForceResync?: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'analytics',
  user,
  currency,
  setCurrency,
  notificationsEnabled,
  onRequestNotificationPermission,
  onForceResync,
  onOpenAuth,
  onLogout,
  onToggleMobileSidebar,
}) => {
  const tabInfo = TAB_TITLES[activeTab] || { title: 'Workspace', subtitle: 'WhatsApp Business' };
  const showCurrency = TABS_WITH_MONEY.includes(activeTab);
  const initials = (user?.name || '')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2);
  const roleLabel = user ? (user.isSuperAdmin ? 'Super admin' : ROLE_LABELS[user.role] || user.role) : '';

  return (
    <header className="wa-hd">
      <div className="wa-hd-left">
        {onToggleMobileSidebar && (
          <button
            type="button"
            className="wa-hd-icon wa-hd-menu"
            onClick={onToggleMobileSidebar}
            title="Open menu"
            aria-label="Open menu"
          >
            <Icon>
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </Icon>
          </button>
        )}

        <div className="wa-hd-title">
          <h1>{tabInfo.title}</h1>
          <p>{tabInfo.subtitle}</p>
        </div>
      </div>

      <div className="wa-hd-right">
        {showCurrency && (
          <label className="wa-hd-select" title="Show amounts in this currency">
            <span className="wa-hd-sr">Currency</span>
            <select value={currency} onChange={e => setCurrency(e.target.value as CurrencyCode)}>
              {CURRENCY_CODES.map(code => (
                <option key={code} value={code}>
                  {CURRENCIES[code].symbol} {code}
                </option>
              ))}
            </select>
          </label>
        )}

        {onForceResync && (
          <button
            type="button"
            className="wa-hd-icon"
            onClick={onForceResync}
            title="Refresh data from the server"
            aria-label="Refresh data from the server"
          >
            <Icon>
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </Icon>
          </button>
        )}

        {onRequestNotificationPermission && (
          <button
            type="button"
            className={`wa-hd-icon wa-hd-bell${notificationsEnabled ? ' is-on' : ''}`}
            onClick={onRequestNotificationPermission}
            disabled={!!notificationsEnabled}
            title={
              notificationsEnabled
                ? 'Desktop notifications are on. You can change this in your browser’s site settings.'
                : 'Turn on desktop notifications for new customer messages'
            }
            aria-label={notificationsEnabled ? 'Desktop notifications are on' : 'Turn on desktop notifications'}
          >
            {notificationsEnabled ? (
              <Icon>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </Icon>
            ) : (
              <Icon>
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
                <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
                <path d="M18 8a6 6 0 0 0-9.33-5" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </Icon>
            )}
          </button>
        )}

        <span className="wa-hd-divider" aria-hidden="true" />

        {user ? (
          <div className="wa-hd-user">
            <div className="wa-hd-avatar" aria-hidden="true">{initials || 'U'}</div>
            <div className="wa-hd-user-text">
              <strong>{user.name}</strong>
              <span>{roleLabel}</span>
            </div>
            <button
              type="button"
              className="wa-hd-icon"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <Icon>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </Icon>
            </button>
          </div>
        ) : (
          <button type="button" className="wa-hd-signin" onClick={onOpenAuth}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
};
