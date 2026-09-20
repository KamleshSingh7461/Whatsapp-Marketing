import React, { useState } from 'react';
import fgsnLogo from '../assets/logo.png';
import { LockIcon, VerifiedBadgeIcon, WhatsAppLogoIcon } from './WhatsAppIcons';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, pass: string) => Promise<void>;
  isMandatory?: boolean;
}

const SUPER_ADMIN_CONTACT = 'admin@fgsnlive.com';

/** Turns transport-level failures into something a support agent can act on. */
function friendlyAuthError(err: any): string {
  const raw = String(err?.message || '');
  if (/failed to fetch|networkerror|load failed|econnrefused|API error 5\d\d/i.test(raw)) {
    return 'Cannot reach the FGSN server right now. Check your connection and try again.';
  }
  return raw || 'Sign in failed. Please check your email and password.';
}

const EyeIcon: React.FC<{ off?: boolean }> = ({ off }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <line x1="3" y1="3" x2="21" y2="21" />}
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  isMandatory = false,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotView, setIsForgotView] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const canSubmit = !!email.trim() && !!password.trim() && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
      onClose();
    } catch (err: any) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const resetMailto = `mailto:${SUPER_ADMIN_CONTACT}?subject=${encodeURIComponent('FGSN ERP password reset request')}`;

  return (
    <div className="wa-auth-screen wa-app-font">
      <div className="wa-auth-band" aria-hidden="true" />

      <div className="wa-auth-shell">
        {/* Brand header — mirrors the sidebar brand block */}
        <header className="wa-auth-brand">
          <div className="wa-auth-logo">
            <img src={fgsnLogo} alt="Freedom Global Sports Network" />
          </div>
          <div className="wa-auth-brand-text">
            <span className="wa-auth-brand-name">
              Freedom Global Sports{' '}
              <span className="wa-auth-nowrap">
                Network
                <VerifiedBadgeIcon size={18} color="#25D366" />
              </span>
            </span>
            <span className="wa-auth-brand-sub">
              <WhatsAppLogoIcon size={13} color="#ffffff" />
              WhatsApp Business ERP
            </span>
          </div>
        </header>

        <main className="wa-auth-card">
          {!isMandatory && (
            <button type="button" className="wa-auth-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}

          {isForgotView ? (
            <>
              <h1 className="wa-auth-title">Reset your password</h1>
              <p className="wa-auth-subtitle">
                For security, password resets are handled by your FGSN Super Admin.
              </p>

              <div className="wa-auth-info">
                Email <a href={resetMailto}>{SUPER_ADMIN_CONTACT}</a> from your work address and
                they will set a new password for you.
              </div>

              <a className="wa-auth-btn" href={resetMailto}>
                Email Super Admin
              </a>

              <button
                type="button"
                className="wa-auth-link wa-auth-link-center"
                onClick={() => setIsForgotView(false)}
              >
                ← Back to sign in
              </button>
            </>
          ) : (
            <>
              <h1 className="wa-auth-title">Sign in to your workspace</h1>
              <p className="wa-auth-subtitle">
                Use your FGSN work account to manage chats, broadcasts and templates.
              </p>

              {error && (
                <div className="wa-auth-error" role="alert">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="wa-auth-field">
                  <label htmlFor="wa-auth-email">Work email</label>
                  <input
                    id="wa-auth-email"
                    type="email"
                    className="wa-auth-input"
                    autoComplete="username"
                    autoFocus
                    required
                    placeholder="you@fgsnlive.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="wa-auth-field">
                  <div className="wa-auth-label-row">
                    <label htmlFor="wa-auth-password">Password</label>
                    <button
                      type="button"
                      className="wa-auth-link"
                      onClick={() => {
                        setError(null);
                        setIsForgotView(true);
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="wa-auth-password-wrap">
                    <input
                      id="wa-auth-password"
                      type={showPassword ? 'text' : 'password'}
                      className="wa-auth-input"
                      autoComplete="current-password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="wa-auth-eye"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <EyeIcon off={showPassword} />
                    </button>
                  </div>
                </div>

                <button type="submit" className="wa-auth-btn" disabled={!canSubmit}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </>
          )}

          <div className="wa-auth-secure">
            <LockIcon size={12} color="#8696a0" />
            <span>Secured with the official Meta WhatsApp Cloud API</span>
          </div>
        </main>

        <footer className="wa-auth-footer">
          Powered by <strong>Freedom Global Sports Network</strong>
        </footer>
      </div>
    </div>
  );
};
