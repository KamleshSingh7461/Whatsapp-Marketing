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

type SettingsTab = 'team' | 'billing' | 'webhook' | 'waba';

const Ico: React.FC<{ size?: number; children: React.ReactNode }> = ({ size = 18, children }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto' }}>
    {children}
  </svg>
);

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
  const [activeTab, setActiveTab] = useState<SettingsTab>('team');

  // WABA Form States
  const [wabaId, setWabaId] = useState(status?.wabaId || '1845046976654799');
  const [phoneNumberId, setPhoneNumberId] = useState(status?.phoneNumberId || '1268849126320372');
  const [businessToken, setBusinessToken] = useState('');
  const [savingWaba, setSavingWaba] = useState(false);
  const [wabaMsg, setWabaMsg] = useState<string | null>(null);

  // Team Management States
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('AGENT');
  const [inviteResult, setInviteResult] = useState<{
    email: string;
    emailSent?: boolean;
    emailMessage?: string;
    inviteLink: string;
  } | null>(null);
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
      setInviteResult({
        email: inviteEmail.trim(),
        emailSent: res.emailSent,
        emailMessage: res.emailMessage,
        inviteLink: link,
      });
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
        return <span className="wa-bc-status tone-admin">Admin</span>;
      case 'MARKETER':
        return <span className="wa-bc-status tone-done">Marketer</span>;
      case 'AGENT':
        return <span className="wa-bc-status tone-live">Support agent</span>;
      default:
        return <span className="wa-bc-status tone-idle">Viewer</span>;
    }
  };

  if (currentUser && currentUser.role !== 'ADMIN') {
    return (
      <div className="wa-bc-page wa-st-page">
        <section className="wa-bc-card wa-st-locked">
          <div className="wa-bc-empty">
            <div className="wa-bc-empty-icon">
              <Ico size={30}>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </Ico>
            </div>
            <h4>Administrator access required</h4>
            <p>
              Your account ({currentUser.email}) has the <strong>{currentUser.role}</strong> role. WABA credentials, team
              management, payment methods and webhook settings can only be changed by an administrator.
            </p>
            <span className="wa-bc-status tone-live">Current role: {currentUser.role}</span>
          </div>
        </section>
      </div>
    );
  }

  const callbackUrl = webhookInfo?.webhookUrl || 'https://api.erp.fgsnlive.com/api/webhooks/whatsapp';
  const verifyToken = webhookInfo?.verifyToken || 'fgsn_secure_webhook_token_2026';
  const testOk = !!testResult && testResult.startsWith('Success');

  const sections: Array<{ id: SettingsTab; title: string; hint: string; icon: React.ReactNode }> = [
    {
      id: 'team',
      title: 'Team & access',
      hint: 'Invite people and set roles',
      icon: (
        <>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      ),
    },
    {
      id: 'billing',
      title: 'Payment & billing',
      hint: 'Meta billing and payment methods',
      icon: (
        <>
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </>
      ),
    },
    {
      id: 'webhook',
      title: 'Webhook',
      hint: 'Live messages and status from Meta',
      icon: (
        <>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>
      ),
    },
    {
      id: 'waba',
      title: 'Cloud API credentials',
      hint: 'Connect your WhatsApp number',
      icon: (
        <>
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </>
      ),
    },
  ];

  return (
    <div className="wa-bc-page wa-st-page">
      <div className="wa-bc-toolbar">
        <p className="wa-bc-lede">
          Manage who can use this workspace, how Meta bills you, and how your WhatsApp number connects.
        </p>
      </div>

      <div className="wa-st-layout">
        {/* Section list */}
        <nav className="wa-st-nav" role="tablist" aria-label="Settings sections">
          {sections.map(s => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={activeTab === s.id}
              className={`wa-st-nav-item${activeTab === s.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(s.id)}
            >
              <span className="wa-st-nav-icon"><Ico>{s.icon}</Ico></span>
              <span className="wa-st-nav-text">
                <strong>{s.title}</strong>
                <span>{s.hint}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="wa-st-content" role="tabpanel">
          {/* TEAM & ACCESS */}
          {activeTab === 'team' && (
            <section className="wa-bc-card">
              <div className="wa-bc-card-head wa-an-card-head">
                <div>
                  <h3 className="wa-bc-card-title">Team members</h3>
                  <p className="wa-an-desc">
                    The super admin (<code className="wa-st-code">admin@fgsnlive.com</code>) can invite people to this
                    workspace with an email link.
                  </p>
                </div>
                <button
                  type="button"
                  className="wa-bc-primary"
                  onClick={() => { setIsInviteOpen(true); setInviteResult(null); setInviteEmail(''); }}
                >
                  <Ico size={16}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Ico>
                  Invite team member
                </button>
              </div>

              {teamMembers.length === 0 ? (
                <p className="wa-st-empty">{loadingTeam ? 'Loading team...' : 'No team members yet.'}</p>
              ) : (
                <ul className="wa-st-list">
                  {teamMembers.map((member) => {
                    const isSelf = currentUser?.id === member.id;
                    return (
                      <li key={member.id} className="wa-st-row">
                        <div className="wa-st-avatar" aria-hidden="true">
                          {member.name ? member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'U'}
                        </div>
                        <div className="wa-st-row-main">
                          <div className="wa-st-row-name">
                            <strong>{member.name}</strong>
                            {member.isSuperAdmin && <span className="wa-bc-status tone-admin">Super admin</span>}
                            {isSelf && <span className="wa-st-you">(You)</span>}
                          </div>
                          <div className="wa-st-row-sub">{member.email}</div>
                        </div>
                        <div className="wa-st-row-tags">
                          {getRoleBadge(member.role)}
                          <span className="wa-bc-status tone-done"><span className="wa-bc-status-dot" />Active</span>
                        </div>
                        {!isSelf && !member.isSuperAdmin && (
                          <button type="button" className="wa-st-danger-btn" onClick={() => handleRemoveMember(member.id)}>
                            Remove
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* PAYMENT & BILLING */}
          {activeTab === 'billing' && (
            <>
              <div className="wa-st-hero">
                <div>
                  <span className="wa-st-hero-kicker">Meta WhatsApp Business Account (WABA)</span>
                  <h3 className="wa-st-hero-title">WABA ID: {metaBilling?.wabaId || '1845046976654799'}</h3>
                  <p className="wa-st-hero-meta">
                    Billing account: <strong>Active direct billing</strong>
                    <span className="wa-st-hero-sep" aria-hidden="true">·</span>
                    Messaging tier: <strong>Tier 10K (10,000 per 24h)</strong>
                  </p>
                </div>
                <a
                  href={metaBilling?.billingHubUrl || 'https://business.facebook.com/billing_hub'}
                  target="_blank"
                  rel="noreferrer"
                  className="wa-st-hero-btn"
                >
                  Open Meta billing hub
                  <Ico size={15}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </Ico>
                </a>
              </div>

              <section className="wa-bc-card">
                <div className="wa-bc-card-head wa-an-card-head">
                  <div>
                    <h3 className="wa-bc-card-title">Payment methods</h3>
                    <p className="wa-an-desc">Cards, UPI or Meta direct billing used for messaging campaigns.</p>
                  </div>
                  <button type="button" className="wa-bc-primary" onClick={() => setIsAddPmOpen(true)}>
                    <Ico size={16}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Ico>
                    Add payment method
                  </button>
                </div>

                {paymentMethods.length === 0 ? (
                  <p className="wa-st-empty">No payment methods added yet.</p>
                ) : (
                  <div className="wa-st-pm-grid">
                    {paymentMethods.map((pm) => (
                      <div key={pm.id} className={`wa-st-pm${pm.isDefault ? ' is-default' : ''}`}>
                        {pm.isDefault && <span className="wa-bc-status tone-done wa-st-pm-flag">Primary</span>}
                        <div className="wa-st-pm-type">{pm.provider} ({pm.type})</div>
                        <h4 className="wa-st-pm-name">{pm.name}</h4>
                        {pm.last4 && <div className="wa-st-pm-num">•••• •••• •••• {pm.last4}</div>}
                        <div className="wa-st-pm-mail">Billing email: {pm.billingEmail}</div>
                        <div className="wa-st-pm-actions">
                          {!pm.isDefault && (
                            <button type="button" className="wa-bc-act" onClick={() => handleSetDefaultPm(pm.id)}>Make primary</button>
                          )}
                          <button type="button" className="wa-st-danger-btn" onClick={() => handleDeletePm(pm.id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* WEBHOOK */}
          {activeTab === 'webhook' && (
            <>
              <section className="wa-bc-card">
                <div className="wa-bc-card-head wa-an-card-head">
                  <div>
                    <h3 className="wa-bc-card-title">Webhook connection</h3>
                    <p className="wa-an-desc">
                      Meta sends incoming messages and delivery updates to this address in real time.
                    </p>
                  </div>
                  <button type="button" className="wa-bc-primary" disabled={testingWebhook} onClick={handleTestWebhook}>
                    <Ico size={16}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Ico>
                    {testingWebhook ? 'Sending test ping...' : 'Test webhook connection'}
                  </button>
                </div>

                {testResult && (
                  <div className={`wa-st-alert ${testOk ? 'is-success' : 'is-error'}`} role="status">
                    {testResult}
                  </div>
                )}

                <dl className="wa-st-kv">
                  <div className="wa-st-kv-row">
                    <dt>Callback URL</dt>
                    <dd><code className="wa-st-code">{callbackUrl}</code></dd>
                  </div>
                  <div className="wa-st-kv-row">
                    <dt>Verify token</dt>
                    <dd><code className="wa-st-code">{verifyToken}</code></dd>
                  </div>
                  <div className="wa-st-kv-row">
                    <dt>Status</dt>
                    <dd><span className="wa-bc-status tone-done"><span className="wa-bc-status-dot" />Verified &amp; active</span></dd>
                  </div>
                  <div className="wa-st-kv-row">
                    <dt>Subscribed fields</dt>
                    <dd>
                      <code className="wa-st-code">messages</code>{' '}
                      <code className="wa-st-code">message_template_status_update</code>
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="wa-bc-card">
                <div className="wa-bc-card-head wa-an-card-head">
                  <div>
                    <h3 className="wa-bc-card-title">Set it up in Meta</h3>
                    <p className="wa-an-desc">Only needed the first time, or if you move to a new server address.</p>
                  </div>
                </div>
                <ol className="wa-au-steps wa-st-steps">
                  <li className="wa-au-step">
                    <span className="wa-au-num" aria-hidden="true">1</span>
                    <div>
                      <p>Log in to the <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">Meta App Dashboard</a>.</p>
                    </div>
                  </li>
                  <li className="wa-au-step">
                    <span className="wa-au-num" aria-hidden="true">2</span>
                    <div><p>Open <strong>WhatsApp</strong>, then <strong>Configuration</strong>.</p></div>
                  </li>
                  <li className="wa-au-step">
                    <span className="wa-au-num" aria-hidden="true">3</span>
                    <div><p>In the <strong>Webhook</strong> section, click <strong>Edit</strong>.</p></div>
                  </li>
                  <li className="wa-au-step">
                    <span className="wa-au-num" aria-hidden="true">4</span>
                    <div><p>Paste the callback URL: <code className="wa-st-code">{callbackUrl}</code></p></div>
                  </li>
                  <li className="wa-au-step">
                    <span className="wa-au-num" aria-hidden="true">5</span>
                    <div><p>Paste the verify token: <code className="wa-st-code">{verifyToken}</code></p></div>
                  </li>
                  <li className="wa-au-step">
                    <span className="wa-au-num" aria-hidden="true">6</span>
                    <div><p>Click <strong>Verify and save</strong>.</p></div>
                  </li>
                  <li className="wa-au-step">
                    <span className="wa-au-num" aria-hidden="true">7</span>
                    <div><p>Under <strong>Webhook fields</strong>, click <strong>Subscribe</strong> next to <code className="wa-st-code">messages</code>.</p></div>
                  </li>
                </ol>
              </section>
            </>
          )}

          {/* CLOUD API CREDENTIALS */}
          {activeTab === 'waba' && (
            <section className="wa-bc-card">
              <div className="wa-bc-card-head wa-an-card-head">
                <div>
                  <h3 className="wa-bc-card-title">Meta Cloud API credentials</h3>
                  <p className="wa-an-desc">
                    These connect your WhatsApp number to this workspace. Find the two IDs in the Meta App Dashboard under
                    WhatsApp, then API Setup.
                  </p>
                </div>
              </div>

              {wabaMsg && <div className="wa-st-alert is-success wa-st-alert-inset" role="status">{wabaMsg}</div>}

              <form onSubmit={handleWabaSubmit} className="wa-st-form">
                <label className="wa-st-field">
                  <span className="wa-st-label">WhatsApp Business Account ID (WABA ID)</span>
                  <input
                    type="text"
                    required
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                    className="wa-st-input"
                  />
                </label>

                <label className="wa-st-field">
                  <span className="wa-st-label">Phone number ID</span>
                  <input
                    type="text"
                    required
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    className="wa-st-input"
                  />
                </label>

                <label className="wa-st-field">
                  <span className="wa-st-label">System user permanent access token</span>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={businessToken}
                    onChange={(e) => setBusinessToken(e.target.value)}
                    className="wa-st-input"
                  />
                  <span className="wa-st-hint">
                    Use a permanent token from a System User in Meta Business Settings. Temporary tokens expire after 24
                    hours. For security the saved token is never shown here; paste a new one to replace it.
                  </span>
                </label>

                <div className="wa-st-form-actions">
                  <button type="submit" className="wa-bc-primary" disabled={savingWaba}>
                    {savingWaba ? 'Updating credentials...' : 'Save & verify connection'}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </div>

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

            {!inviteResult ? (
              <form onSubmit={handleCreateInvite}>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>
                    Work Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. member@fgsnlive.com"
                    className="form-input"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <span style={{ fontSize: 11, color: '#64748B', marginTop: 4, display: 'block' }}>
                    An automated branded invitation email with an onboarding link will be sent to this address.
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>
                    Assign Role
                  </label>
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

                <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsInviteOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary wa-st-btn-icon" disabled={inviteLoading}>
                    {inviteLoading ? 'Sending Invitation...' : (<><Ico size={16}><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><polyline points="22,6 12,13 2,6" /></Ico> Send invitation email</>)}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: 16, borderRadius: 10, marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                    <span style={{ display: 'inline-flex' }}><Ico size={16}><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><polyline points="22,6 12,13 2,6" /></Ico></span>
                    <span>Invitation Email Sent!</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, margin: '0 0 10px 0' }}>
                    {inviteResult.emailMessage || `Invitation email has been sent directly to ${inviteResult.email}.`}
                  </p>
                  <div style={{ display: 'inline-block', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                    Assigned Role: {inviteRole}
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Direct Onboarding Link (Backup)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={inviteResult.inviteLink}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      color: '#0F172A',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary wa-st-btn-icon"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteResult.inviteLink);
                      alert('Invitation link copied to clipboard!');
                    }}
                  >
                    <Ico size={16}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Ico> Copy link
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setInviteEmail('');
                      setInviteResult(null);
                    }}
                  >
                    + Invite Another
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setIsInviteOpen(false);
                      setInviteResult(null);
                    }}
                  >
                    Done
                  </button>
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
