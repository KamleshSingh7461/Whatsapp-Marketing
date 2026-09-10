import React, { useState } from 'react';
import fgsnLogo from '../assets/logo.png';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, pass: string) => Promise<void>;
  isMandatory?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  isMandatory = false,
}) => {
  const [email, setEmail] = useState('admin@fgsnlive.com');
  const [password, setPassword] = useState('Admin@fgsn2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(email, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-card auth-card" style={{ maxWidth: 460, width: '90%' }}>
        <div className="modal-header">
          <div className="auth-brand-head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="fgsn-logo-wrap" style={{ width: 44, height: 44, flexShrink: 0 }}>
              <img src={fgsnLogo} alt="FGSN" className="fgsn-brand-img" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Sign In to FGSN ERP</h3>
              <p className="modal-subtitle" style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Enterprise WhatsApp Marketing & Operations</p>
            </div>
          </div>
          {!isMandatory && <button className="close-btn" onClick={onClose}>✕</button>}
        </div>

        {error && <div className="alert-error-box" style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 12, color: 'var(--text-main)' }}>
          <strong>Super Admin Default Credentials:</strong>
          <div style={{ fontFamily: 'monospace', marginTop: 4, color: 'var(--primary-color)' }}>
            Email: <strong>admin@fgsnlive.com</strong><br />
            Password: <strong>Admin@fgsn2026!</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Work Email</label>
            <input
              type="email"
              required
              placeholder="admin@fgsnlive.com"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Password</label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)' }}
            />
          </div>

          <div className="modal-actions" style={{ marginTop: 24 }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !email.trim() || !password.trim()}
              style={{ width: '100%', padding: '12px', borderRadius: 8, background: 'var(--primary-color)', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
            >
              {loading ? 'Authenticating...' : 'Sign In to Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
