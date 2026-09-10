import React from 'react';
import { User, WhatsappStatus } from '../types';
import { canAccessTab } from '../lib/permissions';
import fgsnLogo from '../assets/logo.png';

export type TabType = 'analytics' | 'inbox' | 'automations' | 'campaigns' | 'templates' | 'contacts' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  status: WhatsappStatus | null;
  unreadCount: number;
  user?: User | null;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  status,
  unreadCount,
  user,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const isConnected = !!status?.connected;
  const limit = status?.dailyMessageLimit ?? 10000;
  const sent = status?.dailyMessagesSent ?? 0;
  const percentUsed = Math.min(100, Math.round((sent / limit) * 100));
  const freeServiceUsed = status?.freeMonthlyServiceUsed ?? 0;
  const role = user?.role || 'ADMIN';

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          title="Close Navigation"
        />
      )}

      <aside className={`sidebar ${isOpenMobile ? 'mobile-open' : ''}`}>
        {/* FGSN Brand Header */}
        <div className="sidebar-brand">
          <div className="fgsn-logo-wrap">
            <img src={fgsnLogo} alt="FGSN" className="fgsn-brand-img" />
          </div>
          <div className="brand-info">
            <span className="brand-title">FGSN</span>
            <span className="brand-subtitle">WhatsApp Enterprise ERP</span>
          </div>

          {onCloseMobile && (
            <button
              className="sidebar-close-btn"
              onClick={onCloseMobile}
              title="Close Navigation Menu"
            >
              ✕
            </button>
          )}
        </div>

        {/* Account / WABA Enterprise Status Card */}
        <div className={`waba-status-card ${isConnected ? 'is-active' : 'is-unconfigured'}`}>
          <div className="waba-card-top">
            <div className="waba-status-left">
              <span className={`waba-pulse-dot ${isConnected ? 'live' : 'pending'}`}>
                <span className="pulse-ring" />
              </span>
              <span className="waba-conn-label">{isConnected ? 'WABA Active' : 'Setup Required'}</span>
            </div>
            <span className="waba-tier-badge">
              {isConnected ? (status?.tier?.replace('_', ' ') || 'Tier 10K') : 'Meta Cloud API'}
            </span>
          </div>

          <div className="waba-phone-box">
            <div className="waba-phone-info">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="waba-phone-icon">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span className="waba-phone-val">
                {status?.displayPhoneNumber ? status.displayPhoneNumber : isConnected ? '+1 (555) 019-2834' : 'No Phone Linked'}
              </span>
            </div>
            {!isConnected && canAccessTab(user?.role, 'settings') && (
              <button
                type="button"
                className="waba-quick-connect-btn"
                onClick={() => handleSelectTab('settings')}
                title="Connect WhatsApp Business Account"
              >
                Configure
              </button>
            )}
          </div>
          
          {/* Daily Quota Progress */}
          <div className="waba-quota-box">
            <div className="waba-quota-labels">
              <span className="waba-quota-title">Daily Meta Limit</span>
              <span className="waba-quota-count">{sent.toLocaleString()} / {limit.toLocaleString()}</span>
            </div>
            <div className="tier-progress-track">
              <div className="tier-progress-fill" style={{ width: `${Math.max(4, percentUsed)}%` }} />
            </div>
          </div>

          {/* Micro Stats Grid */}
          <div className="waba-micro-metrics">
            <div className="micro-metric-item">
              <span className="micro-lbl">Today's Sent</span>
              <span className="micro-val">{sent.toLocaleString()}</span>
            </div>
            <div className="micro-metric-item highlight-green">
              <span className="micro-lbl">Free Care Left</span>
              <span className="micro-val">{Math.max(0, 1000 - freeServiceUsed)} / 1,000</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {canAccessTab(user?.role, 'analytics') && (
            <button
              className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => handleSelectTab('analytics')}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span className="nav-label">Executive Analytics</span>
            </button>
          )}

          {canAccessTab(user?.role, 'inbox') && (
            <button
              className={`nav-item ${activeTab === 'inbox' ? 'active' : ''}`}
              onClick={() => handleSelectTab('inbox')}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="nav-label">Live Shared Inbox</span>
              {unreadCount > 0 && <span className="nav-badge-count">{unreadCount}</span>}
            </button>
          )}

          {canAccessTab(user?.role, 'automations') && (
            <button
              className={`nav-item ${activeTab === 'automations' ? 'active' : ''}`}
              onClick={() => handleSelectTab('automations')}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span className="nav-label">Automated Workflows</span>
            </button>
          )}

          {canAccessTab(user?.role, 'campaigns') && (
            <button
              className={`nav-item ${activeTab === 'campaigns' ? 'active' : ''}`}
              onClick={() => handleSelectTab('campaigns')}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              <span className="nav-label">Broadcast Marketing</span>
            </button>
          )}

          {canAccessTab(user?.role, 'templates') && (
            <button
              className={`nav-item ${activeTab === 'templates' ? 'active' : ''}`}
              onClick={() => handleSelectTab('templates')}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span className="nav-label">Template Studio</span>
            </button>
          )}

          {canAccessTab(user?.role, 'contacts') && (
            <button
              className={`nav-item ${activeTab === 'contacts' ? 'active' : ''}`}
              onClick={() => handleSelectTab('contacts')}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="nav-label">Audience & CRM</span>
            </button>
          )}

          {canAccessTab(user?.role, 'settings') && (
            <>
              <div className="nav-divider" />
              <button
                className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => handleSelectTab('settings')}
              >
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span className="nav-label">WABA Settings</span>
              </button>
            </>
          )}
        </nav>

        {/* Footer Info */}
        <div className="sidebar-footer">
          <div className="meta-graph-badge">
            <span className="api-dot" />
            <span>Meta Graph API v21.0</span>
          </div>
        </div>
      </aside>
    </>
  );
};
