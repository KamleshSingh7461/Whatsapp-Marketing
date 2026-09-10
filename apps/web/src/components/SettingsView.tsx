import React, { useState } from 'react';
import { User, Role, WhatsappStatus } from '../types';

interface SettingsViewProps {
  status: WhatsappStatus | null;
  currentUser: User | null;
  teamMembers: User[];
  onConnectWaba: (data: { wabaId: string; phoneNumberId: string; businessToken: string }) => Promise<void>;
  onAddTeamMember: (member: Omit<User, 'id'>) => void;
  onRemoveTeamMember: (id: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  status,
  currentUser,
  teamMembers,
  onConnectWaba,
  onAddTeamMember,
  onRemoveTeamMember,
}) => {
  // WABA Form States
  const [wabaId, setWabaId] = useState(status?.wabaId || '1845046976654799');
  const [phoneNumberId, setPhoneNumberId] = useState(status?.phoneNumberId || '1313091738548766');
  const [businessToken, setBusinessToken] = useState('EAAOxk98214...');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite Modal States
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('AGENT');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wabaId || !phoneNumberId || !businessToken) return;
    setSaving(true);
    try {
      await onConnectWaba({ wabaId, phoneNumberId, businessToken });
      setSuccessMsg('WhatsApp Business Account credentials successfully verified and encrypted with AES-256-GCM.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    onAddTeamMember({
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
    });

    setIsInviteOpen(false);
    setInviteName('');
    setInviteEmail('');
    setInviteRole('AGENT');
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
      <div className="page-header-row">
        <div>
          <h2 className="view-title">FGSN Enterprise Settings & Access Control</h2>
          <p className="view-subtitle">
            Configure Meta Cloud API production credentials, manage multi-role team permissions, and monitor system security.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setIsInviteOpen(true)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Invite Team Member
        </button>
      </div>

      {successMsg && (
        <div className="alert-success-box">
          {successMsg}
        </div>
      )}

      {/* Production CLI Seeding & Setup Card */}
      <div className="corporate-guide-box" style={{ background: '#F8FAFC', borderLeft: '4px solid #059669' }}>
        <h3 className="guide-title">Production Database Seeding & Super Admin Provisioning</h3>
        <p style={{ fontSize: '0.84rem', color: '#475569', marginBottom: 10 }}>
          To seed or re-seed the initial <strong>Super Admin</strong>, <strong>Operations Admin</strong>, and <strong>Support Agents</strong> directly in your PostgreSQL database, execute the production seeder command in terminal:
        </p>
        <div style={{ background: '#0F172A', color: '#38BDF8', padding: '10px 14px', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.82rem', marginBottom: 10 }}>
          npm run seed
        </div>
        <p style={{ fontSize: '0.78rem', color: '#64748B' }}>
          Custom Super Admin credentials can be injected via environment variables: <code>SEED_SUPER_ADMIN_EMAIL=admin@fgsn.com SEED_SUPER_ADMIN_PASSWORD=your_secure_password npm run seed</code>
        </p>
      </div>

      {/* Team Management Table */}
      <div className="panel-card" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Active Team Members & Role Hierarchy</h3>
            <p className="panel-desc">Manage authenticated users and departmental permission boundaries</p>
          </div>
        </div>

        <table className="corporate-table">
          <thead>
            <tr>
              <th>Team Member</th>
              <th>Work Email</th>
              <th>Assigned Role</th>
              <th>Access Scope</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((member) => {
              const isSelf = currentUser?.id === member.id;
              return (
                <tr key={member.id}>
                  <td>
                    <div className="contact-cell">
                      <div className="avatar-sm">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <strong>{member.name}</strong>
                        {isSelf && <span style={{ fontSize: '0.72rem', color: '#059669', marginLeft: 6, fontWeight: 600 }}>(You)</span>}
                      </div>
                    </div>
                  </td>
                  <td><code>{member.email}</code></td>
                  <td>{getRoleBadge(member.role)}</td>
                  <td>
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      {member.role === 'ADMIN'
                        ? 'Master WABA Controls, Billing & Team Management'
                        : member.role === 'MARKETER'
                        ? 'Broadcast Campaigns, Templates & Audience CRM'
                        : member.role === 'AGENT'
                        ? 'Shared Inbox, Customer Care & Ticket Resolution'
                        : 'Read-only Executive Analytics'}
                    </span>
                  </td>
                  <td>
                    {!isSelf && (
                      <button
                        className="btn-outline-sm"
                        style={{ color: '#DC2626', borderColor: '#FECACA' }}
                        onClick={() => onRemoveTeamMember(member.id)}
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

      {/* Meta Production Settings Grid */}
      <div className="settings-grid">
        {/* Left: Credentials Form */}
        <div className="panel-card">
          <h3 className="panel-title">Meta Cloud API Production Credentials</h3>
          <p className="panel-desc" style={{ marginBottom: 16 }}>
            Credentials are encrypted at rest using AES-256-GCM symmetric ciphers.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>WhatsApp Business Account ID (WABA ID)</label>
              <input
                type="text"
                required
                placeholder="e.g. 109845728392019"
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
                placeholder="e.g. 104829104829104"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>System User Permanent Token</label>
              <input
                type="password"
                required
                placeholder="EAA..."
                value={businessToken}
                onChange={(e) => setBusinessToken(e.target.value)}
                className="form-input"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Verifying & Subscribing Webhooks…' : 'Save & Verify Connection'}
            </button>
          </form>
        </div>

        {/* Right: Status & Architecture */}
        <div className="panel-card">
          <h3 className="panel-title">Production Webhook & Security Endpoints</h3>

          <div className="waba-status-overview" style={{ marginTop: 16 }}>
            <div className="status-row">
              <span className="status-lbl">Webhook URL:</span>
              <code>https://api.fgsn.com/webhooks/whatsapp</code>
            </div>

            <div className="status-row">
              <span className="status-lbl">Webhook Signature Verification:</span>
              <span className="text-primary-brand">X-Hub-Signature-256 (SHA256)</span>
            </div>

            <div className="status-row">
              <span className="status-lbl">Messaging Tier:</span>
              <strong>Tier 10K (10,000 unique conversations / 24h)</strong>
            </div>

            <div className="status-row">
              <span className="status-lbl">Phone Quality Score:</span>
              <span className="status-chip success">Green (High Quality)</span>
            </div>

            <div className="status-row">
              <span className="status-lbl">Token Cipher:</span>
              <span>AES-256-GCM Encrypted at Rest</span>
            </div>

            <div className="status-row">
              <span className="status-lbl">Graph API Version:</span>
              <span>v21.0 (Enterprise Certified)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Invite Team Member</h3>
                <p className="modal-subtitle">Grant role-based access to the FGSN WhatsApp ERP</p>
              </div>
              <button className="close-btn" onClick={() => setIsInviteOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleInviteSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  className="form-input"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Work Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alex@fgsn.com"
                  className="form-input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Role Assignment</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="form-input"
                >
                  <option value="AGENT">Support Agent (Live Chat & Shared Inbox)</option>
                  <option value="MARKETER">Marketing Manager (Broadcasts & Templates)</option>
                  <option value="ADMIN">Operations Admin (Full Workspace Access)</option>
                  <option value="VIEWER">Viewer (Read-Only Analytics)</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsInviteOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Send Invite & Grant Access</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
