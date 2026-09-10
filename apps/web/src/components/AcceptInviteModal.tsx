import React, { useEffect, useState } from 'react';
import fgsnLogo from '../assets/logo.png';
import { registerInviteApi, validateInviteApi } from '../lib/api';

interface AcceptInviteModalProps {
  token: string;
  onSuccess: (user: any) => void;
  onCancel: () => void;
}

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

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-card auth-card" style={{ maxWidth: 480, width: '90%' }}>
        <div className="modal-header" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={fgsnLogo} alt="FGSN" style={{ width: 42, height: 42, objectFit: 'contain' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Accept Workspace Invitation</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                FGSN WhatsApp ERP Access
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        {validating ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            Validating invitation token...
          </div>
        ) : error && !inviteDetails ? (
          <div style={{ padding: 16, background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13 }}>
            <strong>Invitation Error:</strong> {error}
            <div style={{ marginTop: 12 }}>
              <button className="btn-secondary" onClick={onCancel}>Return to Login</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding: 10, background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, fontSize: 12, marginBottom: 16 }}>
              <div>Invited By: <strong>{inviteDetails?.invitedByName || 'Administrator'}</strong></div>
              <div>Assigned Role: <span className="badge badge-primary" style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{inviteDetails?.role}</span></div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Work Email</label>
              <input
                type="email"
                disabled
                value={inviteDetails?.email || ''}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', opacity: 0.8 }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Create Password</label>
              <input
                type="password"
                required
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Confirm Password</label>
              <input
                type="password"
                required
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !name.trim() || !password.trim()}
              style={{ width: '100%', padding: 12, background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
            >
              {submitting ? 'Setting up Account...' : 'Complete Registration & Join'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
