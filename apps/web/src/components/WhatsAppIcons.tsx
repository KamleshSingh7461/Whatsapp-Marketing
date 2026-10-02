import React from 'react';

export const WhatsAppLogoIcon: React.FC<{ size?: number; className?: string; color?: string }> = ({ size = 24, className = '', color = '#25D366' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill={color}>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.04 20.16C10.56 20.16 9.11 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16ZM16.56 14.37C16.31 14.24 15.09 13.64 14.86 13.56C14.64 13.48 14.47 13.44 14.31 13.69C14.14 13.94 13.67 14.49 13.52 14.66C13.38 14.83 13.23 14.85 12.98 14.73C12.73 14.6 11.93 14.34 10.98 13.49C10.24 12.83 9.74 12.02 9.59 11.77C9.44 11.52 9.58 11.38 9.7 11.26C9.82 11.14 9.96 10.96 10.09 10.81C10.21 10.66 10.26 10.56 10.34 10.39C10.42 10.22 10.38 10.08 10.32 9.95C10.26 9.82 9.76 8.59 9.55 8.09C9.35 7.6 9.15 7.66 9 7.66C8.86 7.65 8.7 7.65 8.53 7.65C8.36 7.65 8.09 7.71 7.86 7.96C7.63 8.21 7 8.8 7 10C7 11.2 7.88 12.36 8 12.53C8.13 12.69 9.73 15.16 12.18 16.22C12.76 16.47 13.22 16.62 13.57 16.73C14.16 16.92 14.69 16.89 15.12 16.83C15.6 16.76 16.59 16.23 16.8 15.65C17 15.06 17 14.57 16.94 14.46C16.88 14.36 16.71 14.3 16.56 14.37Z" />
  </svg>
);

export const DoubleCheckIcon: React.FC<{ isRead?: boolean; size?: number }> = ({ isRead = false, size = 16 }) => (
  <svg viewBox="0 0 16 11" width={size} height={Math.round(size * 0.7)} fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path
      d="M11.15 1.15a.5.5 0 0 0-.7-.05L5.7 5.25 4.3 3.85a.5.5 0 0 0-.7.7l1.75 1.75a.5.5 0 0 0 .73-.02l5-4.4a.5.5 0 0 0 .07-.73z"
      fill={isRead ? '#53bdeb' : '#8696a0'}
    />
    <path
      d="M14.65 1.15a.5.5 0 0 0-.7-.05L9.2 5.25l-.47-.47a.5.5 0 1 0-.7.7l.82.82a.5.5 0 0 0 .73-.02l5-4.4a.5.5 0 0 0 .07-.73z"
      fill={isRead ? '#53bdeb' : '#8696a0'}
    />
  </svg>
);

export const SingleCheckIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#8696a0' }) => (
  <svg viewBox="0 0 16 11" width={size} height={Math.round(size * 0.7)} fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path
      d="M11.15 1.15a.5.5 0 0 0-.7-.05L5.7 5.25 4.3 3.85a.5.5 0 0 0-.7.7l1.75 1.75a.5.5 0 0 0 .73-.02l5-4.4a.5.5 0 0 0 .07-.73z"
      fill={color}
    />
  </svg>
);

/**
 * Verified-business badge geometry (24 x 24 box, centre 12,12).
 *
 * The outline is an 8-lobed rosette generated from r(t) = R + A·cos(8t), so every lobe
 * and valley is identical and the shape is symmetric about both axes and both diagonals.
 * One lobe points straight up.
 */
const BADGE_LOBES = 8;
const BADGE_PATH = (() => {
  const centre = 12;
  const baseRadius = 10.25;
  const lobeDepth = 1.05;
  const steps = 160;
  let d = '';
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2 - Math.PI / 2; // start at the top of a lobe
    const r = baseRadius + lobeDepth * Math.cos(BADGE_LOBES * t);
    const x = centre + r * Math.cos(t);
    const y = centre + r * Math.sin(t);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`;
  }
  return `${d}Z`;
})();

/**
 * Tick: both legs run at exactly 45° (2.8/2.8 and 5.8/5.8) so they meet at a true right angle,
 * long leg ≈ 2× the short leg, and the stroked bounding box is centred on (12,12).
 */
const BADGE_TICK = 'M7.7 12.1L10.5 14.9L16.3 9.1';

export const VerifiedBadgeIcon: React.FC<{ size?: number; color?: string }> = ({ size = 15, color = '#00a884' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="true"
    focusable="false"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
  >
    <path d={BADGE_PATH} fill={color} />
    <path d={BADGE_TICK} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SearchIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

export const NewChatIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H8v-2h4V6h2v4h4v2z" />
  </svg>
);

export const MenuDotsIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

export const SmileyIcon: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

export const PaperclipIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

export const SendIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#ffffff' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

export const BackArrowIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export const PhoneCallIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export const VideoCallIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

export const LockIcon: React.FC<{ size?: number; color?: string }> = ({ size = 13, color = '#8696a0' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const UserAvatarPlaceholder: React.FC<{ size?: number }> = ({ size = 49 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: '#dfe5e7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      flexShrink: 0,
      overflow: 'hidden',
    }}
  >
    <svg viewBox="0 0 24 24" width={Math.round(size * 0.75)} height={Math.round(size * 0.75)} fill="#cfd6d8">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  </div>
);

export const TemplateIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const ChatsNavIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export const BroadcastIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
    <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
    <path d="M19.1 4.9c3.9 3.9 3.9 10.3 0 14.2" />
  </svg>
);

export const ContactsNavIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const AutomationsNavIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const AnalyticsNavIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

export const SettingsNavIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const CloseIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/** The curved reply arrow WhatsApp shows on a template's quick-reply button. */
export const ReplyArrowIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#027eb5' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 14 4 9 9 4" />
    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
  </svg>
);

/** The "opens a link" arrow for a template's URL button. */
export const ExternalLinkIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#027eb5' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const CopyIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const TagIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

export const RefreshSyncIcon: React.FC<{ size?: number; color?: string }> = ({ size = 15, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
  </svg>
);

export const NotificationBellIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export const NotificationBellOffIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
    <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
    <path d="M18 8a6 6 0 0 0-9.33-5" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);



export const DownloadIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const UploadIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export const UserPlusIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#ffffff' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="16" y1="11" x2="22" y2="11" />
  </svg>
);

export const PencilIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

export const FlameIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

export const StarIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const RepeatIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

export const ShieldCheckIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

export const LayersIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

export const AlertTriangleIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#b45309' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const CallSheetNavIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

/* ==========================================================================
   Attachments: file-type badges, the attach menu and media player glyphs, drawn after WhatsApp's own
   ========================================================================== */

// Colours WhatsApp uses for each kind of file, and the label shown on the badge.
const FILE_TYPES: Array<{ exts: string[]; mime?: RegExp; label?: string; color: string }> = [
  { exts: ['pdf'], mime: /pdf/, label: 'PDF', color: '#E2574C' },
  { exts: ['doc', 'docx', 'odt', 'rtf'], mime: /word|opendocument\.text|rtf/, label: 'DOC', color: '#2A5699' },
  { exts: ['xls', 'xlsx', 'ods'], mime: /excel|sheet/, label: 'XLS', color: '#1F7244' },
  { exts: ['csv'], mime: /csv/, label: 'CSV', color: '#1F7244' },
  { exts: ['ppt', 'pptx', 'odp'], mime: /powerpoint|presentation/, label: 'PPT', color: '#D04423' },
  { exts: ['zip', 'rar', '7z', 'gz'], mime: /zip|rar|compressed|7z/, label: 'ZIP', color: '#7C6A55' },
  { exts: ['txt'], mime: /^text\/plain/, label: 'TXT', color: '#5E6E78' },
  { exts: ['mp3', 'ogg', 'opus', 'm4a', 'aac', 'amr', 'wav'], mime: /^audio\//, color: '#FA6533' },
  { exts: ['mp4', '3gp', 'mov', 'webm'], mime: /^video\//, color: '#7F66FF' },
  { exts: ['jpg', 'jpeg', 'png', 'webp', 'gif'], mime: /^image\//, color: '#007BFC' },
];

/** Upper-case short label and colour for a file, from its name first and its type second. */
export function fileTypeOf(fileName?: string, mime?: string): { label: string; color: string } {
  const ext = (fileName || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] || '';
  const m = (mime || '').toLowerCase();
  const hit = FILE_TYPES.find(t => (ext && t.exts.includes(ext)) || (m && t.mime?.test(m)));
  const label = hit?.label || (ext ? ext.toUpperCase().slice(0, 4) : m.split('/').pop()?.split(/[.;+-]/)[0].toUpperCase().slice(0, 4) || 'FILE');
  return { label, color: hit?.color || '#8696A0' };
}

/** A page with a folded corner and the file type on it, as on WhatsApp document messages. */
export const FileTypeIcon: React.FC<{ fileName?: string; mime?: string; size?: number }> = ({ fileName, mime, size = 32 }) => {
  const { label, color } = fileTypeOf(fileName, mime);
  return (
    <svg viewBox="0 0 30 36" width={Math.round(size * 0.833)} height={size} aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <path d="M4 0h15.5L29 9.5V33a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3z" fill={color} />
      <path d="M19.5 0v6.5a3 3 0 0 0 3 3H29z" fill="#ffffff" fillOpacity="0.45" />
      <text
        x="15"
        y="28.5"
        textAnchor="middle"
        fill="#ffffff"
        fontSize={label.length > 3 ? 6.4 : 7.6}
        fontWeight="700"
        fontFamily="'Segoe UI', Helvetica, Arial, sans-serif"
        letterSpacing="0.2"
      >
        {label}
      </text>
    </svg>
  );
};

export const PlusIcon: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const AttachDocumentIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#7F66FF' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M14 2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5V8z" fill={color} />
    <path d="M14 2v4a2 2 0 0 0 2 2h4z" fill="#ffffff" fillOpacity="0.5" />
    <rect x="7.5" y="12" width="9" height="1.6" rx="0.8" fill="#ffffff" />
    <rect x="7.5" y="15.6" width="6" height="1.6" rx="0.8" fill="#ffffff" />
  </svg>
);

export const AttachPhotosIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#007BFC' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="3" fill={color} />
    <circle cx="16" cy="9" r="1.8" fill="#ffffff" />
    <path d="M5 17.2l4.2-5.2 3.1 3.7 2.3-2.7 4.4 4.2z" fill="#ffffff" />
  </svg>
);

export const AttachAudioIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#FA6533' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path
      d="M12 3a9 9 0 0 0-9 9v5.5A2.5 2.5 0 0 0 5.5 20H7a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H5v-1a7 7 0 0 1 14 0v1h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1.5a2.5 2.5 0 0 0 2.5-2.5V12a9 9 0 0 0-9-9z"
      fill={color}
    />
  </svg>
);

export const MicIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#ffffff' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true">
    <path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V5.5a3.5 3.5 0 0 0-7 0V11a3.5 3.5 0 0 0 3.5 3.5z" />
    <path d="M18 11a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.09A6 6 0 0 0 18 11z" />
  </svg>
);

export const PlayIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.9-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" />
  </svg>
);

export const PauseIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#54656f' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);

export const VideoBadgeIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#ffffff' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true">
    <path d="M16 7.5A1.5 1.5 0 0 0 14.5 6h-10A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h10a1.5 1.5 0 0 0 1.5-1.5v-2.7l4.2 3.15a.5.5 0 0 0 .8-.4V7.45a.5.5 0 0 0-.8-.4L16 10.2z" />
  </svg>
);

export const DownloadCircleIcon: React.FC<{ size?: number; color?: string }> = ({ size = 32, color = '#8696a0' }) => (
  <svg viewBox="0 0 34 34" width={size} height={size} fill="none" aria-hidden="true">
    <circle cx="17" cy="17" r="15.5" stroke={color} strokeWidth="1.5" />
    <path d="M17 10v12m0 0l-5-5m5 5l5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const MediaUnavailableIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = '#8696a0' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M3 4l18 16" />
    <circle cx="15.5" cy="9" r="1.5" />
  </svg>
);
