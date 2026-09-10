import React, { useState } from 'react';
import fgsnLogo from '../assets/logo.png';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, pass: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLogin,
}) => {
  const [email, setEmail] = useState('superadmin@fgsn.com');
  const [password, setPassword] = useState('');
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
    <div className="modal-overlay">
      <div className="modal-card auth-card">
        <div className="modal-header">
          <div className="auth-brand-head">
            <div className="fgsn-logo-wrap">
              <img src={fgsnLogo} alt="FGSN" className="fgsn-brand-img" />
            </div>
            <div>
              <h3 className="modal-title">Sign In to FGSN ERP</h3>
              <p className="modal-subtitle">Enterprise WhatsApp Marketing & Operations Suite</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert-error-box">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Work Email</label>
            <input
              type="email"
              required
              placeholder="e.g. superadmin@fgsn.com"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="modal-actions" style={{ marginTop: 24 }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !email.trim() || !password.trim()}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? 'Authenticating...' : 'Sign In to Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
