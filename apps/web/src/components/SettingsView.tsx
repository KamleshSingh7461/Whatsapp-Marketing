import React, { useEffect, useState } from 'react';
import { User, Role, WhatsappStatus } from '../types';
import {
  createInviteApi,
  deleteTeamMemberApi,
  getTeamMembersApi,
  getPaymentMethodsApi,
  addPaymentMethodApi,
  setDefaultPaymentMethodApi,
  deletePaymentMethodApi,
  getMetaBillingStatusApi,
  getWebhookStatusApi,
  testWebhookPingApi,
} from '../lib/api';

interface SettingsViewProps {
  status: WhatsappStatus | null;
  currentUser: User | null;
  onConnectWaba: (data: { wabaId: string; phoneNumberId: string; businessToken: string }) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  status,
  currentUser,
  onConnectWaba,
}) => {
  const [activeTab, setActiveTab] = useState<'team' | 'billing' | 'webhook' | 'waba'>('team');

  // WABA Form States
  const [wabaId, setWabaId] = useState(status?.wabaId || '1845046976654799');
  const [phoneNumberId, setPhoneNumberId] = useState(status?.phoneNumberId || '1268849126320372');
  const [businessToken, setBusinessToken] = useState('EAAPNSGTJkv8BSaschi0VLUJFgDrhcjKb7DFlGF2t7jj1eVK0smzfWlApqZCxmBl23rHXZC6jV83vPRlvTyZAr4RvLGDxa0JrlCD8MIxEl7oqhMMQeMb8okTFZAesImMUDwZC5FZA4oWgZB9z8EYbfjOmZC04ile6fYBfgxd5INFEZBf4MxBbqbAP8hCaRNugPlQZDZD');
  const [savingWaba, setSavingWaba] = useState(false);
  const [wabaMsg, setWabaMsg] = useState<string | null>(null);

  // Team Management States
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('AGENT');
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Payment Methods & Billing States
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [metaBilling, setMetaBilling] = useState<any>(null);
  const [isAddPmOpen, setIsAddPmOpen] = useState(false);
  const [pmType, setPmType] = useState('CREDIT_CARD');
  const [pmName, setPmName] = useState('');
  const [pmProvider, setPmProvider] = useState('VISA');
  const [pmLast4, setPmLast4] = useState('');
  const [pmExpiry, setPmExpiry] = useState('');
  const [pmEmail, setPmEmail] = useState('admin@fgsnlive.com');
  const [savingPm, setSavingPm] = useState(false);

  // Webhook States
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Load team members, billing, and webhooks
  useEffect(() => {
    loadTeam();
    loadBilling();
    loadWebhook();
  }, []);

  const loadTeam = async () => {
    try {
      setLoadingTeam(true);
      const members = await getTeamMembersApi();
      setTeamMembers(members);
    } catch {
      // Fallback
    } finally {
      setLoadingTeam(false);
    }
  };

  const loadBilling = async () => {
    try {
      const [pms, meta] = await Promise.all([
        getPaymentMethodsApi(),
        getMetaBillingStatusApi(),
      ]);
      setPaymentMethods(pms);
      setMetaBilling(meta);
    } catch {
      // Ignore
    }
  };

  const loadWebhook = async () => {
    try {
      const info = await getWebhookStatusApi();
      setWebhookInfo(info);
    } catch {
      // Ignore
    }
  };

  // Invite Team Member
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setInviteLoading(true);
      const res = await createInviteApi(inviteEmail.trim(), inviteRole);
      const link = `${window.location.origin}/#invite?token=${res.token}`;
      setGeneratedInviteLink(link);
      loadTeam();
    } catch (err: any) {
      alert(err.message || 'Failed to create invite');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (id: string) => {
    if (!confirm('Are you sure you want to revoke workspace access for this member?')) return;
    try {
      await deleteTeamMemberApi(id);
      loadTeam();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Add Payment Method
  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pmName.trim()) return;

    try {
      setSavingPm(true);
      await addPaymentMethodApi({
        type: pmType,
        name: pmName.trim(),
        provider: pmProvider,
        last4: pmLast4 || undefined,
        expiry: pmExpiry || undefined,
        billingEmail: pmEmail || 'admin@fgsnlive.com',
        isDefault: paymentMethods.length === 0,
      });
      setIsAddPmOpen(false);
      setPmName('');
      setPmLast4('');
      setPmExpiry('');
      loadBilling();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingPm(false);
    }
  };

  const handleSetDefaultPm = async (id: string) => {
    try {
      await setDefaultPaymentMethodApi(id);
      loadBilling();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePm = async (id: string) => {
    if (!confirm('Remove this payment method?')) return;
    try {
      await deletePaymentMethodApi(id);
      loadBilling();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Webhook Test Ping
  const handleTestWebhook = async () => {
    try {
      setTestingWebhook(true);
      setTestResult(null);
      const res = await testWebhookPingApi();
      setTestResult(`Success! Verified live ping payload at ${new Date(res.timestamp).toLocaleTimeString()}`);
    } catch (err: any) {
      setTestResult(`Webhook Test Error: ${err.message}`);
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleWabaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wabaId || !phoneNumberId || !businessToken) return;
    setSavingWaba(true);
    try {
      await onConnectWaba({ wabaId, phoneNumberId, businessToken });
      setWabaMsg('Meta Cloud API production credentials updated successfully.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingWaba(false);
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return <span className="status-chip highlight" style={{ background: '#EDE9FE', color: '#6D28D9' }}>Admin / Super Admin</span>;
      case 'MARKETER':
        return <span className="status-chip success">Growth & Marketer</span>;
      case 'AGENT':
        return <span className="status-chip warning" style={{ background: '#FEF3C7', color: '#B45309' }}>Support Agent</span>;
      default:
        return <span className="status-chip neutral">Viewer</span>;
    }
  };

  return (
    <div className="view-container">
      <div className="page-header-row" style={{ marginBottom: 16 }}>
        <div>
          <h2 className="view-title">FGSN Enterprise Settings & Control Center</h2>
          <p className="view-subtitle">
            Manage team access, payment methods, Meta Cloud API billing, and webhooks.
          </p>
        </div>
      </div>

      {/* Tabs Header */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '2px solid var(--border-color)', marginBottom: 24, paddingBottom: 8 }}>
        <button
          className={`btn-secondary ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
          style={{
            background: activeTab === 'team' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'team' ? '#fff' : 'var(--text-main)',
            borderColor: activeTab === 'team' ? 'var(--primary-color)' : 'var(--border-color)',
            padding: '8px 16px',
            fontWeight: 600,
          }}
        >
          Team & Access Invites
        </button>

        <button
          className={`btn-secondary ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
          style={{
            background: activeTab === 'billing' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'billing' ? '#fff' : 'var(--text-main)',
            borderColor: activeTab === 'billing' ? 'var(--primary-color)' : 'var(--border-color)',
            padding: '8px 16px',
            fontWeight: 600,
          }}
        >
          Payment Methods & Meta Billing
        </button>

        <button
          className={`btn-secondary ${activeTab === 'webhook' ? 'active' : ''}`}
          onClick={() => setActiveTab('webhook')}
          style={{
            background: activeTab === 'webhook' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'webhook' ? '#fff' : 'var(--text-main)',
            borderColor: activeTab === 'webhook' ? 'var(--primary-color)' : 'var(--border-color)',
            padding: '8px 16px',
            fontWeight: 600,
          }}
        >
          Meta Webhook Configuration
        </button>

        <button
          className={`btn-secondary ${activeTab === 'waba' ? 'active' : ''}`}
          onClick={() => setActiveTab('waba')}
          style={{
            background: activeTab === 'waba' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'waba' ? '#fff' : 'var(--text-main)',
            borderColor: activeTab === 'waba' ? 'var(--primary-color)' : 'var(--border-color)',
            padding: '8px 16px',
            fontWeight: 600,
          }}
        >
          Meta Cloud API Credentials
        </button>
      </div>

      {/* TAB 1: TEAM & ACCESS INVITES */}
      {activeTab === 'team' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Team Members & Invites</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Super Admin (<code>admin@fgsnlive.com</code>) can invite team members to join workspace via email link.
              </p>
            </div>
            <button className="btn-primary" onClick={() => { setIsInviteOpen(true); setGeneratedInviteLink(null); }}>
              + Invite Team Member
            </button>
          </div>

          <div className="panel-card">
            <table className="corporate-table">
              <thead>
                <tr>
                  <th>Team Member</th>
                  <th>Work Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((member) => {
                  const isSelf = currentUser?.id === member.id;
                  return (
                    <tr key={member.id}>
                      <td>
                        <div className="contact-cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar-sm" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                            {member.name ? member.name.split(' ').map((n: string) => n[0]).join('') : 'U'}
                          </div>
                          <div>
                            <strong>{member.name}</strong>
                            {member.isSuperAdmin && <span style={{ fontSize: 10, background: '#EDE9FE', color: '#6D28D9', padding: '2px 6px', borderRadius: 4, marginLeft: 6, fontWeight: 700 }}>SUPER ADMIN</span>}
                            {isSelf && <span style={{ fontSize: 11, color: '#059669', marginLeft: 6, fontWeight: 600 }}>(You)</span>}
                          </div>
                        </div>
                      </td>
                      <td><code>{member.email}</code></td>
                      <td>{getRoleBadge(member.role)}</td>
                      <td>
                        <span className="status-chip success">Active</span>
                      </td>
                      <td>
                        {!isSelf && !member.isSuperAdmin && (
                          <button
                            className="btn-outline-sm"
                            style={{ color: '#DC2626', borderColor: '#FECACA' }}
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT METHODS & META BILLING */}
      {activeTab === 'billing' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Payment Methods & Meta WABA Billing</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Configure credit cards, UPI, or Meta Direct WABA Billing for messaging campaigns.
              </p>
            </div>
            <button className="btn-primary" onClick={() => setIsAddPmOpen(true)}>
              + Add Payment Method
            </button>
          </div>

          {/* Meta WABA Billing Account Banner */}
          <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', color: '#fff', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', fontWeight: 700 }}>Meta WhatsApp Business Account (WABA)</div>
                <h3 style={{ margin: '4px 0 8px', fontSize: 20, color: '#F8FAFC' }}>WABA ID: {metaBilling?.wabaId || '1845046976654799'}</h3>
                <div style={{ fontSize: 13, color: '#CBD5E1' }}>
                  Billing Account Status: <span style={{ color: '#4ADE80', fontWeight: 600 }}>Active Direct Billing</span> | Messaging Tier: <strong>Tier 10K (10,000/24h)</strong>
                </div>
              </div>
              <a
                href={metaBilling?.billingHubUrl || 'https://business.facebook.com/billing_hub'}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{ background: '#2563EB', textDecoration: 'none', color: '#fff', padding: '10px 16px', borderRadius: 8 }}
              >
                Open Meta Business Manager Billing Hub ↗
              </a>
            </div>
          </div>

          {/* Saved Payment Methods Grid */}
          <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>Configured ERP Payment Methods</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="panel-card" style={{ border: pm.isDefault ? '2px solid var(--primary-color)' : '1px solid var(--border-color)', position: 'relative' }}>
                {pm.isDefault && (
                  <span style={{ position: 'absolute', top: 12, right: 12, background: 'var(--primary-color)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                    PRIMARY DEFAULT
                  </span>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{pm.provider} ({pm.type})</div>
                <h4 style={{ margin: '6px 0 10px', fontSize: 16 }}>{pm.name}</h4>
                {pm.last4 && <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>•••• •••• •••• {pm.last4}</div>}
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Billing Email: <code>{pm.billingEmail}</code></div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  {!pm.isDefault && (
                    <button className="btn-outline-sm" onClick={() => handleSetDefaultPm(pm.id)}>Make Primary</button>
                  )}
                  <button className="btn-outline-sm" style={{ color: '#DC2626', borderColor: '#FECACA' }} onClick={() => handleDeletePm(pm.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: META WEBHOOK CONFIGURATION */}
      {activeTab === 'webhook' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Meta WhatsApp Webhook Configuration</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Production callback URL and signature verification settings for real-time incoming messages.
              </p>
            </div>
            <button className="btn-primary" disabled={testingWebhook} onClick={handleTestWebhook}>
              {testingWebhook ? 'Sending Test Ping...' : '⚡ Test Webhook Connection'}
            </button>
          </div>

          {testResult && (
            <div style={{ padding: '12px 16px', background: testResult.startsWith('Success') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testResult.startsWith('Success') ? '#bbf7d0' : '#fecaca'}`, color: testResult.startsWith('Success') ? '#166534' : '#dc2626', borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 600 }}>
              {testResult}
            </div>
          )}

          <div className="settings-grid">
            <div className="panel-card">
              <h3 className="panel-title">Production Webhook Credentials</h3>
              <div className="waba-status-overview" style={{ marginTop: 16 }}>
                <div className="status-row">
                  <span className="status-lbl">Callback URL:</span>
                  <code style={{ fontSize: 13, color: 'var(--primary-color)', fontWeight: 700 }}>
                    {webhookInfo?.webhookUrl || 'https://api.erp.fgsnlive.com/api/webhooks/whatsapp'}
                  </code>
                </div>

                <div className="status-row">
                  <span className="status-lbl">Verify Token:</span>
                  <code style={{ fontSize: 13, color: '#059669', fontWeight: 700 }}>
                    {webhookInfo?.verifyToken || 'fgsn_secure_webhook_token_2026'}
                  </code>
                </div>

                <div className="status-row">
                  <span className="status-lbl">Status:</span>
                  <span className="status-chip success">Verified & Active</span>
                </div>

                <div className="status-row">
                  <span className="status-lbl">Subscribed Fields:</span>
                  <span>messages, message_template_status_update</span>
                </div>
              </div>
            </div>

            <div className="panel-card">
              <h3 className="panel-title">Meta Developer Console Instructions</h3>
              <ol style={{ fontSize: 13, color: 'var(--text-main)', paddingLeft: 20, margin: '12px 0 0', lineHeight: 1.6 }}>
                <li>Log in to <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">Meta App Dashboard ↗</a>.</li>
                <li>Navigate to <strong>WhatsApp</strong> ➔ <strong>Configuration</strong>.</li>
                <li>In the <strong>Webhook</strong> section, click <strong>Edit</strong>.</li>
                <li>Paste Callback URL: <code>https://api.erp.fgsnlive.com/api/webhooks/whatsapp</code>.</li>
                <li>Paste Verify Token: <code>fgsn_secure_webhook_token_2026</code>.</li>
                <li>Click <strong>Verify and Save</strong>.</li>
                <li>Under Webhook fields, click <strong>Subscribe</strong> for <code>messages</code>.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: META CLOUD API CREDENTIALS */}
      {activeTab === 'waba' && (
        <div className="panel-card" style={{ maxWidth: 650 }}>
          <h3 className="panel-title">Meta Cloud API Production Credentials</h3>
          {wabaMsg && <div className="alert-success-box" style={{ marginTop: 10 }}>{wabaMsg}</div>}

          <form onSubmit={handleWabaSubmit} style={{ marginTop: 16 }}>
            <div className="form-group">
              <label>WhatsApp Business Account ID (WABA ID)</label>
              <input
                type="text"
                required
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Phone Number ID</label>
              <input
                type="text"
                required
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>System User Permanent Access Token</label>
              <input
                type="password"
                required
                value={businessToken}
                onChange={(e) => setBusinessToken(e.target.value)}
                className="form-input"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={savingWaba}>
              {savingWaba ? 'Updating Credentials...' : 'Save & Verify Connection'}
            </button>
          </form>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: 460, width: '90%' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Invite Team Member</h3>
                <p className="modal-subtitle">Generate an access invitation link</p>
              </div>
              <button className="close-btn" onClick={() => setIsInviteOpen(false)}>✕</button>
            </div>

            {!generatedInviteLink ? (
              <form onSubmit={handleCreateInvite}>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label>Work Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. member@fgsnlive.com"
                    className="form-input"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label>Assign Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                    className="form-input"
                  >
                    <option value="AGENT">Support Agent (Live Chat & Inbox)</option>
                    <option value="MARKETER">Marketing Manager (Broadcasts & Templates)</option>
                    <option value="ADMIN">Operations Admin (Full Access)</option>
                    <option value="VIEWER">Viewer (Read-Only Analytics)</option>
                  </select>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsInviteOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={inviteLoading}>
                    {inviteLoading ? 'Generating Link...' : 'Create Invite Link'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 14, borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ color: '#166534', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Invitation Link Created!</div>
                  <div style={{ fontSize: 12, color: 'var(--text-main)', marginBottom: 8 }}>
                    Share this unique invitation link with <strong>{inviteEmail}</strong>:
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 11, fontFamily: 'monospace', borderRadius: 6, border: '1px solid var(--border-color)', background: '#fff' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteLink);
                      alert('Invitation link copied to clipboard!');
                    }}
                  >
                    📋 Copy Link
                  </button>
                  <button className="btn-secondary" onClick={() => setIsInviteOpen(false)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {isAddPmOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: 460, width: '90%' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Add Payment Method</h3>
                <p className="modal-subtitle">Configure billing details for ERP operations</p>
              </div>
              <button className="close-btn" onClick={() => setIsAddPmOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleAddPaymentMethod}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Method Type</label>
                <select className="form-input" value={pmType} onChange={(e) => setPmType(e.target.value)}>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="DEBIT_CARD">Debit Card</option>
                  <option value="UPI">UPI / NetBanking</option>
                  <option value="META_BILLING">Meta Direct WABA Account ID</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corporate Visa Ending in 4242"
                  className="form-input"
                  value={pmName}
                  onChange={(e) => setPmName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Provider</label>
                <input
                  type="text"
                  required
                  placeholder="VISA / MASTERCARD / RAZORPAY / META"
                  className="form-input"
                  value={pmProvider}
                  onChange={(e) => setPmProvider(e.target.value)}
                />
              </div>

              {pmType !== 'UPI' && pmType !== 'META_BILLING' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label>Last 4 Digits</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="4242"
                      className="form-input"
                      value={pmLast4}
                      onChange={(e) => setPmLast4(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Expiry Date</label>
                    <input
                      type="text"
                      placeholder="12/28"
                      className="form-input"
                      value={pmExpiry}
                      onChange={(e) => setPmExpiry(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Billing Email</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  value={pmEmail}
                  onChange={(e) => setPmEmail(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsAddPmOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={savingPm}>
                  {savingPm ? 'Saving...' : 'Save Payment Method'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
