import React from 'react';
import { User } from '../types';
import { CurrencyCode } from '../lib/currency';

interface HeaderProps {
  user: User | null;
  timeframe: '7d' | '30d' | '90d';
  setTimeframe: (t: '7d' | '30d' | '90d') => void;
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  timeframe,
  setTimeframe,
  currency,
  setCurrency,
  onOpenAuth,
  onLogout,
  onToggleMobileSidebar,
}) => {
  return (
    <header className="top-header">
      <div className="header-left">
        {onToggleMobileSidebar && (
          <button
            className="mobile-hamburger-btn"
            onClick={onToggleMobileSidebar}
            title="Open Navigation Menu"
            aria-label="Toggle navigation menu"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <div className="header-title-wrap">
          <h1 className="header-title">FGSN Operations Portal</h1>
          <div className="header-brand-badge hide-on-mobile" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#10B981', marginLeft: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 8px #10B981' }}></span>
            Freedom Global Sports Network (+91 86558 51749)
          </div>
        </div>
      </div>

      <div className="header-right">
        {/* Universal Currency Selector */}
        <div className="currency-segmented-group" title="Select Display Currency">
          {(['INR', 'USD', 'EUR', 'GBP'] as const).map(c => (
            <button
              key={c}
              className={`currency-seg-btn ${currency === c ? 'active' : ''}`}
              onClick={() => setCurrency(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Date Range Selector */}
        <div className="date-filter-segmented">
          <button
            className={`date-seg-btn ${timeframe === '7d' ? 'active' : ''}`}
            onClick={() => setTimeframe('7d')}
          >
            7d
          </button>
          <button
            className={`date-seg-btn ${timeframe === '30d' ? 'active' : ''}`}
            onClick={() => setTimeframe('30d')}
          >
            30d
          </button>
          <button
            className={`date-seg-btn ${timeframe === '90d' ? 'active' : ''}`}
            onClick={() => setTimeframe('90d')}
          >
            Quarter
          </button>
        </div>

        {/* User Account & Role Badge */}
        <div className="header-user-container">
          {user ? (
            <div className="header-user-badge">
              <div className="header-user-avatar">
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="header-user-details hide-on-mobile">
                <span className="header-user-name">{user.name}</span>
                <span className="header-user-role-badge">{user.role}</span>
              </div>
              <button className="header-logout-btn" onClick={onLogout} title="Sign Out">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={onOpenAuth}>
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
