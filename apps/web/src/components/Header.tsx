import React from 'react';
import { User } from '../types';
import { CurrencyCode } from '../lib/currency';
import fgsnLogo from '../assets/logo.png';

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

        <div className="header-brand-corporate">
          <div className="header-logo-mini">
            <img src={fgsnLogo} alt="FGSN" />
          </div>
          <div className="header-brand-text">
            <div className="header-title-row">
              <span className="header-company-name">Freedom Global Sports Network</span>
              <span className="corporate-badge-pill hide-on-compact">Command Center</span>
            </div>
            <div className="header-status-line hide-on-compact">
              <span className="live-status-dot" />
              <span className="waba-number-text">Meta WABA Active • +91 86558 51749</span>
            </div>
          </div>
        </div>
      </div>

      <div className="header-right">
        {/* Single Global Currency Switcher */}
        <div className="currency-segmented-group" title="Global Display Currency">
          {(['INR', 'USD', 'EUR', 'GBP'] as const).map(c => (
            <button
              key={c}
              className={`currency-seg-btn ${currency === c ? 'active' : ''}`}
              onClick={() => setCurrency(c)}
            >
              {c === 'INR' ? '₹ INR' : c === 'USD' ? '$ USD' : c === 'EUR' ? '€ EUR' : '£ GBP'}
            </button>
          ))}
        </div>

        {/* Date Range Selector */}
        <div className="date-filter-segmented hide-on-compact">
          <button
            className={`date-seg-btn ${timeframe === '7d' ? 'active' : ''}`}
            onClick={() => setTimeframe('7d')}
          >
            7 Days
          </button>
          <button
            className={`date-seg-btn ${timeframe === '30d' ? 'active' : ''}`}
            onClick={() => setTimeframe('30d')}
          >
            30 Days
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
              <div className="header-user-details hide-on-compact">
                <span className="header-user-name">{user.name}</span>
                <span className={`header-user-role-badge ${user.isSuperAdmin ? 'super-admin' : ''}`}>
                  {user.isSuperAdmin ? 'SUPER ADMIN' : user.role}
                </span>
              </div>
              <button className="header-logout-btn" onClick={onLogout} title="Sign Out of Workspace">
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
