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
  const [email, setEmail] = useState('');
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
      setError(err.message || 'Authentication failed. Please verify email & password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#0B0F17',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div
        className="modal-card auth-card"
        style={{
          maxWidth: 440,
          width: '100%',
          background: '#131B2E',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          padding: 32,
          color: '#F8FAFC',
        }}
      >
        <div className="modal-header" style={{ marginBottom: 24, borderBottom: 'none', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255, 255, 255, 0.05)', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={fgsnLogo} alt="FGSN Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#FFFFFF' }}>Sign In to FGSN ERP</h3>
              <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0' }}>Enterprise WhatsApp Marketing Suite</p>
            </div>
          </div>
          {!isMandatory && (
            <button className="close-btn" onClick={onClose} style={{ color: '#94A3B8' }}>✕</button>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
              fontSize: 13,
              marginBottom: 20,
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 8 }}>
              Work Email Address
            </label>
            <input
              type="email"
              required
              placeholder="e.g. admin@fgsnlive.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: '#0F172A',
                color: '#FFFFFF',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 8 }}>
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: '#0F172A',
                color: '#FFFFFF',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 15,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
};
