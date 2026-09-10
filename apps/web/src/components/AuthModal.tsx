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
        backgroundColor: '#F8FAFC',
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(5, 150, 105, 0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(37, 99, 235, 0.06) 0px, transparent 50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: 20,
        boxSizing: 'border-box',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
          padding: '36px 32px',
          color: '#0F172A',
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img src={fgsnLogo} alt="FGSN Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Sign In to FGSN ERP
            </h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: '3px 0 0', fontWeight: 500 }}>
              Enterprise WhatsApp Marketing & Operations
            </p>
          </div>
          {!isMandatory && (
            <button
              onClick={onClose}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                fontSize: 16,
                padding: 4,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              fontSize: 13,
              marginBottom: 20,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>
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
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'all 0.15s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#059669';
                e.target.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#CBD5E1';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ marginBottom: 26 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>
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
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'all 0.15s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#059669';
                e.target.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#CBD5E1';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 8,
              backgroundColor: '#059669',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: loading || !email.trim() || !password.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
              opacity: loading || !email.trim() || !password.trim() ? 0.7 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {loading ? 'Authenticating Workspace...' : 'Sign In to Workspace'}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
            Powered by <strong>Freedom Global Sports Network</strong> • Enterprise ERP
          </span>
        </div>
      </div>
    </div>
  );
};
