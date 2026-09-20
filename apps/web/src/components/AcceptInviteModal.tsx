import React, { useEffect, useState } from 'react';
import fgsnLogo from '../assets/logo.png';
import { registerInviteApi, validateInviteApi } from '../lib/api';
import { LockIcon, VerifiedBadgeIcon, WhatsAppLogoIcon } from './WhatsAppIcons';

interface AcceptInviteModalProps {
  token: string;
  onSuccess: (user: any) => void;
  onCancel: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Operations Admin',
  MARKETER: 'Marketing Manager',
  AGENT: 'Support Agent',
  VIEWER: 'Viewer',
};

export const AcceptInviteModal: React.FC<AcceptInviteModalProps> = ({
  token,
  onSuccess,
  onCancel,
}) => {
  const [inviteDetails, setInviteDetails] = useState<{
    email: string;
    role: string;
    invitedByName: string;
  } | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validating, setValidating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkInvite() {
      try {
        setValidating(true);
        const details = await validateInviteApi(token);
        setInviteDetails(details);
      } catch (err: any) {
        setError(err.message || 'Invalid or expired invite token.');
      } finally {
        setValidating(false);
      }
    }
    if (token) {
      checkInvite();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await registerInviteApi(token, name, password);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Failed to complete registration');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && !!name.trim() && !!password.trim() && !!confirmPassword.trim();
  const roleLabel = inviteDetails ? ROLE_LABELS[inviteDetails.role] || inviteDetails.role : '';

  const errorBox = error && (
    <div className="wa-auth-error" role="alert">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{error}</span>
    </div>
  );

  return (
    <div className="wa-auth-screen wa-app-font">
      <div className="wa-auth-band" aria-hidden="true" />

      <div className="wa-auth-shell">
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
          {validating ? (
            <>
              <h1 className="wa-auth-title">Checking your invitation…</h1>
              <p className="wa-auth-subtitle">This only takes a moment.</p>
            </>
          ) : error && !inviteDetails ? (
            <>
              <h1 className="wa-auth-title">Invitation problem</h1>
              <p className="wa-auth-subtitle">We couldn't open this invitation.</p>
              {errorBox}
              <button type="button" className="wa-auth-btn" onClick={onCancel}>
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <h1 className="wa-auth-title">Join your workspace</h1>
              <p className="wa-auth-subtitle">
                {inviteDetails?.invitedByName || 'An administrator'} invited you as{' '}
                <strong>{roleLabel}</strong>. Set up your account to get started.
              </p>

              {errorBox}

              <form onSubmit={handleSubmit} noValidate>
                <div className="wa-auth-field">
                  <label htmlFor="wa-invite-email">Work email</label>
                  <input
                    id="wa-invite-email"
                    type="email"
                    className="wa-auth-input"
                    autoComplete="username"
                    disabled
                    value={inviteDetails?.email || ''}
                    readOnly
                  />
                </div>

                <div className="wa-auth-field">
                  <label htmlFor="wa-invite-name">Full name</label>
                  <input
                    id="wa-invite-name"
                    type="text"
                    className="wa-auth-input"
                    autoComplete="name"
                    required
                    placeholder="e.g. Elena Vance"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="wa-auth-field">
                  <label htmlFor="wa-invite-password">Create password</label>
                  <input
                    id="wa-invite-password"
                    type="password"
                    className="wa-auth-input"
                    autoComplete="new-password"
                    required
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="wa-auth-field">
                  <label htmlFor="wa-invite-confirm">Confirm password</label>
                  <input
                    id="wa-invite-confirm"
                    type="password"
                    className="wa-auth-input"
                    autoComplete="new-password"
                    required
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <button type="submit" className="wa-auth-btn" disabled={!canSubmit}>
                  {submitting ? 'Setting up your account…' : 'Create account and join'}
                </button>

                <button type="button" className="wa-auth-link wa-auth-link-center" onClick={onCancel}>
                  Cancel
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
