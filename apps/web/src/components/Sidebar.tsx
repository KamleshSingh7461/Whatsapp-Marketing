import React, { useRef } from 'react';
import { User, WhatsappStatus } from '../types';
import { canAccessTab } from '../lib/permissions';
import fgsnLogo from '../assets/logo.png';
import {
  WhatsAppLogoIcon,
  VerifiedBadgeIcon,
  ChatsNavIcon,
  BroadcastIcon,
  TemplateIcon,
  ContactsNavIcon,
  AutomationsNavIcon,
  CallSheetNavIcon,
  AnalyticsNavIcon,
  SettingsNavIcon,
  LockIcon,
} from './WhatsAppIcons';

export type TabType = 'analytics' | 'inbox' | 'automations' | 'calls' | 'campaigns' | 'templates' | 'contacts' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  status: WhatsappStatus | null;
  unreadCount: number;
  user?: User | null;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  status,
  unreadCount,
  user,
  isOpenMobile = false,
  onCloseMobile,
  onLogout,
}) => {
  const isConnected = !!status?.connected;
  const role = user?.role || 'ADMIN';

  // Mobile Touch Swipe Left to close sidebar drawer
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (dx < -50 && Math.abs(dx) > Math.abs(dy)) {
      if (onCloseMobile) onCloseMobile();
    }
  };

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

      <aside
        className={`sidebar wa-app-font ${isOpenMobile ? 'mobile-open' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {/* Authentic WhatsApp Business Header */}
        <div className="wa-sidebar-brand">
          <div className="wa-brand-left">
            <div className="wa-brand-icon-wrap">
              <img src={fgsnLogo} alt="Freedom Global" className="wa-brand-fgsn-logo" />
              <div className="wa-brand-waba-subicon">
                <WhatsAppLogoIcon size={13} color="#25D366" />
              </div>
            </div>
            <div className="wa-brand-text-col">
              <div className="wa-brand-heading">
                <span>Freedom Global</span>
                <VerifiedBadgeIcon size={14} />
              </div>
              <span className="wa-brand-subheading">WhatsApp Business</span>
            </div>
          </div>

          {onCloseMobile && (
            <button
              className="sidebar-close-btn"
              onClick={onCloseMobile}
              title="Close Navigation"
              type="button"
            >
              ✕
            </button>
          )}
        </div>

        {/* Live WABA Account Info Card */}
        <div className="wa-account-badge">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="wa-account-dot" />
            <span>{isConnected ? 'Connected' : 'Setup Required'}</span>
          </div>
          <span className="wa-account-num">
            {status?.displayPhoneNumber || '+91 86558 51749'}
          </span>
        </div>

        {/* Authentic WhatsApp Navigation Menu */}
        <nav className="wa-nav-menu">
          {/* Chats / Live Shared Inbox */}
          {canAccessTab(role, 'inbox') && (
            <button
              className={`wa-nav-item ${activeTab === 'inbox' ? 'active' : ''}`}
              onClick={() => handleSelectTab('inbox')}
              type="button"
            >
              <ChatsNavIcon size={20} color={activeTab === 'inbox' ? '#008069' : '#54656f'} />
              <span>Chats</span>
              {unreadCount > 0 && <span className="wa-nav-badge">{unreadCount}</span>}
            </button>
          )}

          {/* Broadcast Campaigns */}
          {canAccessTab(role, 'campaigns') && (
            <button
              className={`wa-nav-item ${activeTab === 'campaigns' ? 'active' : ''}`}
              onClick={() => handleSelectTab('campaigns')}
              type="button"
            >
              <BroadcastIcon size={20} color={activeTab === 'campaigns' ? '#008069' : '#54656f'} />
              <span>Broadcasts</span>
            </button>
          )}

          {/* WhatsApp Approved Template Studio */}
          {canAccessTab(role, 'templates') && (
            <button
              className={`wa-nav-item ${activeTab === 'templates' ? 'active' : ''}`}
              onClick={() => handleSelectTab('templates')}
              type="button"
            >
              <TemplateIcon size={20} color={activeTab === 'templates' ? '#008069' : '#54656f'} />
              <span>Templates</span>
            </button>
          )}

          {/* Contacts & Customer CRM */}
          {canAccessTab(role, 'contacts') && (
            <button
              className={`wa-nav-item ${activeTab === 'contacts' ? 'active' : ''}`}
              onClick={() => handleSelectTab('contacts')}
              type="button"
            >
              <ContactsNavIcon size={20} color={activeTab === 'contacts' ? '#008069' : '#54656f'} />
              <span>Contacts & CRM</span>
            </button>
          )}

          {/* Automated Workflows & Chatbots */}
          {canAccessTab(role, 'automations') && (
            <button
              className={`wa-nav-item ${activeTab === 'automations' ? 'active' : ''}`}
              onClick={() => handleSelectTab('automations')}
              type="button"
            >
              <AutomationsNavIcon size={20} color={activeTab === 'automations' ? '#008069' : '#54656f'} />
              <span>Automations</span>
            </button>
          )}

          {/* Call sheets: follow-up calls to customers who tapped a button */}
          {canAccessTab(role, 'calls') && (
            <button
              className={`wa-nav-item ${activeTab === 'calls' ? 'active' : ''}`}
              onClick={() => handleSelectTab('calls')}
              type="button"
            >
              <CallSheetNavIcon size={20} color={activeTab === 'calls' ? '#008069' : '#54656f'} />
              <span>Call sheets</span>
            </button>
          )}

          {/* Analytics & Performance */}
          {canAccessTab(role, 'analytics') && (
            <button
              className={`wa-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => handleSelectTab('analytics')}
              type="button"
            >
              <AnalyticsNavIcon size={20} color={activeTab === 'analytics' ? '#008069' : '#54656f'} />
              <span>Analytics</span>
            </button>
          )}

          {/* WABA Settings */}
          {canAccessTab(role, 'settings') && (
            <>
              <div className="wa-nav-divider" />
              <button
                className={`wa-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => handleSelectTab('settings')}
                type="button"
              >
                <SettingsNavIcon size={20} color={activeTab === 'settings' ? '#008069' : '#54656f'} />
                <span>WABA Settings</span>
              </button>
            </>
          )}
        </nav>

        {/* User Profile & Footer */}
        <div className="wa-sidebar-profile">
          <div className="wa-profile-user">
            <div className="wa-profile-avatar">
              {(user?.name || 'A')[0].toUpperCase()}
            </div>
            <div>
              <div className="wa-profile-name">{user?.name || 'Admin'}</div>
              <span className="wa-profile-role">{role}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#008069', fontWeight: 600 }}>Active</span>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Log out"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#8696a0',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 4,
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Meta Business Partner Tag */}
        <div className="wa-meta-partner-tag">
          <LockIcon size={12} color="#8696a0" />
          <span>Meta Cloud API &bull; Tier 10K</span>
        </div>
      </aside>
    </>
  );
};
