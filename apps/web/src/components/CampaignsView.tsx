import React, { useState } from 'react';
import { Campaign, Contact, Template, User } from '../types';
import { CurrencyCode, formatCurrency } from '../lib/currency';
import { canCreateCampaigns } from '../lib/permissions';

interface CampaignsViewProps {
  campaigns: Campaign[];
  templates: Template[];
  contacts?: Contact[];
  currency?: CurrencyCode;
  currentUser?: User | null;
  onLaunchCampaign: (campaign: Campaign) => void;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  templates,
  contacts = [],
  currency = 'INR',
  currentUser,
  onLaunchCampaign,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || '');

  // Extract all unique tags present across contacts in CRM
  const crmTags = Array.from(new Set(contacts.flatMap(c => c.tags || []))).filter(Boolean);

  const [selectedTag, setSelectedTag] = useState(crmTags[0] || 'All Opted-In');
  const [recipientsCount, setRecipientsCount] = useState(contacts.length > 0 ? contacts.length : 1000);

  const totalCampaignRevenue = campaigns.reduce((acc, c) => acc + c.stats.revenue, 0);
  const totalCampaignCost = campaigns.reduce((acc, c) => acc + c.stats.cost, 0);
  const totalSent = campaigns.reduce((acc, c) => acc + c.stats.sent, 0);
  const totalConverted = campaigns.reduce((acc, c) => acc + c.stats.converted, 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim()) return;

    const chosenTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0] || {
      id: 'tpl_default',
      name: 'broadcast_announcement',
      category: 'MARKETING' as const,
    };

    const newCampaign: Campaign = {
      id: `cmp_${Date.now()}`,
      name: campaignName.trim(),
      templateId: chosenTemplate.id,
      templateName: chosenTemplate.name,
      category: chosenTemplate.category,
      status: 'SENDING',
      sentAt: new Date().toISOString(),
      targetTags: [selectedTag],
      totalRecipients: recipientsCount,
      stats: {
        sent: recipientsCount,
        delivered: Math.round(recipientsCount * 0.98),
        read: Math.round(recipientsCount * 0.85),
        clickedOrReplied: Math.round(recipientsCount * 0.32),
        converted: Math.round(recipientsCount * 0.09),
        failed: Math.round(recipientsCount * 0.02),
        revenue: Math.round(recipientsCount * 0.09 * 145),
        cost: Math.round(recipientsCount * 0.085),
      },
    };

    onLaunchCampaign(newCampaign);
    setIsModalOpen(false);
    setCampaignName('');
  };

  const estCostNum = recipientsCount * 0.085;
  const estRevenueNum = recipientsCount * 0.09 * 145;

  return (
    <div className="view-container">
      <div className="page-header-row">
        <div>
          <h2 className="view-title">Broadcast Campaigns</h2>
          <p className="view-subtitle">Manage high-throughput outbound WhatsApp marketing and announcement broadcasts</p>
        </div>
        {canCreateCampaigns(currentUser?.role) && (
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Broadcast
          </button>
        )}
      </div>

      {/* Campaign Highlights Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Broadcast Attributed Sales</span>
          </div>
          <div className="metric-primary-value text-primary-brand">{formatCurrency(totalCampaignRevenue, currency)}</div>
          <div className="metric-footer-text">Generated from {campaigns.length} campaigns</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Completed Orders</span>
          </div>
          <div className="metric-primary-value">{totalConverted.toLocaleString()}</div>
          <div className="metric-footer-text">{totalSent > 0 ? ((totalConverted / totalSent) * 100).toFixed(1) : '0'}% overall conversion</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Outbound Cost</span>
          </div>
          <div className="metric-primary-value">{formatCurrency(totalCampaignCost, currency)}</div>
          <div className="metric-footer-text">{formatCurrency(totalConverted > 0 ? totalCampaignCost / totalConverted : 0, currency, 2)} cost per order</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Campaign ROI Multiple</span>
          </div>
          <div className="metric-primary-value">{totalCampaignCost > 0 ? (totalCampaignRevenue / totalCampaignCost).toFixed(1) : '0.0'}x</div>
          <div className="metric-footer-text">Gross revenue return</div>
        </div>
      </div>

      {/* Campaigns Table or Zero-State */}
      <div className="panel-card">
        <div className="panel-header">
          <h3 className="panel-title">Campaign History</h3>
        </div>

        {campaigns.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#F1F5F9', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>No Broadcast Campaigns Dispatched</h4>
            <p style={{ fontSize: '0.84rem', color: '#64748B', maxWidth: 440, margin: '0 auto 16px auto', lineHeight: 1.4 }}>
              Broadcast marketing allows you to reach verified opt-in customer lists with approved WhatsApp templates at high delivery rates.
            </p>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              Launch Your First Broadcast
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="corporate-table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Target Segment</th>
                  <th>Status</th>
                  <th>Delivered / Sent</th>
                  <th>Open Rate</th>
                  <th>CTR</th>
                  <th>Orders</th>
                  <th>Attributed Sales</th>
                  <th>Meta Spend</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((cmp) => {
                  const readRate = cmp.stats.delivered > 0 ? ((cmp.stats.read / cmp.stats.delivered) * 100).toFixed(1) : '0';
                  const ctr = cmp.stats.read > 0 ? ((cmp.stats.clickedOrReplied / cmp.stats.read) * 100).toFixed(1) : '0';

                  return (
                    <tr key={cmp.id}>
                      <td>
                        <div className="table-title">{cmp.name}</div>
                        <div className="table-sub">{cmp.templateName}</div>
                      </td>
                      <td>
                        {cmp.targetTags.map((t, i) => (
                          <span key={i} className="tag-pill-corporate">{t}</span>
                        ))}
                      </td>
                      <td>
                        <span className={`status-chip ${cmp.status === 'COMPLETED' ? 'success' : cmp.status === 'SENDING' ? 'warning' : 'neutral'}`}>
                          {cmp.status === 'COMPLETED' ? 'Completed' : cmp.status === 'SENDING' ? 'In Progress' : 'Scheduled'}
                        </span>
                      </td>
                      <td>
                        <div><strong>{cmp.stats.delivered.toLocaleString()}</strong> / {cmp.stats.sent.toLocaleString()}</div>
                        <div className="table-sub">{cmp.stats.sent > 0 ? ((cmp.stats.delivered / cmp.stats.sent) * 100).toFixed(1) : 0}% delivery</div>
                      </td>
                      <td>
                        <div><strong>{cmp.stats.read.toLocaleString()}</strong></div>
                        <div className="table-sub">{readRate}% open</div>
                      </td>
                      <td>
                        <div><strong>{cmp.stats.clickedOrReplied.toLocaleString()}</strong></div>
                        <div className="table-sub">{ctr}% CTR</div>
                      </td>
                      <td>
                        <span className="status-chip neutral">{cmp.stats.converted.toLocaleString()}</span>
                      </td>
                      <td>
                        <strong className="text-primary-brand">{formatCurrency(cmp.stats.revenue, currency)}</strong>
                      </td>
                      <td>
                        <span className="text-secondary">{formatCurrency(cmp.stats.cost, currency)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Broadcast Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Configure Outbound Broadcast</h3>
                <p className="modal-subtitle">Dispatch approved template message to audience segment</p>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Campaign Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Fall Collection Launch"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Message Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="form-input"
                >
                  {templates.length === 0 ? (
                    <option value="tpl_default">Direct Marketing Broadcast (Standard Rate)</option>
                  ) : (
                    templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Target Audience Cohort / Dynamic CRM Tag</label>
                <select
                  value={selectedTag}
                  onChange={(e) => {
                    const tag = e.target.value;
                    setSelectedTag(tag);
                    
                    if (tag === 'All Opted-In') {
                      setRecipientsCount(contacts.length || 1000);
                    } else if (tag.startsWith('Batch 1')) {
                      setRecipientsCount(Math.min(500, contacts.length || 500));
                    } else if (tag.startsWith('Batch 2')) {
                      setRecipientsCount(Math.max(1, Math.min(500, (contacts.length || 1000) - 500)));
                    } else if (tag.startsWith('Batch 3') || tag.startsWith('Batch 4')) {
                      setRecipientsCount(Math.max(1, Math.min(1000, contacts.length || 1000)));
                    } else {
                      const matchCount = contacts.filter(c => c.tags && c.tags.includes(tag)).length;
                      setRecipientsCount(matchCount > 0 ? matchCount : 500);
                    }
                  }}
                  className="form-input"
                >
                  <optgroup label="📋 Dynamic CRM Contact Tags">
                    {crmTags.length === 0 ? (
                      <option value="New Lead">New Lead Tag</option>
                    ) : (
                      crmTags.map(t => {
                        const count = contacts.filter(c => c.tags && c.tags.includes(t)).length;
                        return (
                          <option key={t} value={t}>
                            Tag: {t} ({count} {count === 1 ? 'contact' : 'contacts'})
                          </option>
                        );
                      })
                    )}
                  </optgroup>

                  <optgroup label="📦 Batch Segment Chunks (Safety Limit)">
                    <option value="Batch 1: Contacts 1 - 500">Batch 1: Contacts 1 - 500 (500 max)</option>
                    <option value="Batch 2: Contacts 501 - 1000">Batch 2: Contacts 501 - 1,000 (500 max)</option>
                    <option value="Batch 3: Contacts 1001 - 2000">Batch 3: Contacts 1,001 - 2,000 (1,000 max)</option>
                    <option value="Batch 4: Contacts 2001 - 3000">Batch 4: Contacts 2,001 - 3,000 (1,000 max)</option>
                  </optgroup>

                  <optgroup label="🌐 Global Database">
                    <option value="All Opted-In">All Opted-In Database ({contacts.length} total contacts)</option>
                    <option value="Internal Team Test Group">Internal Team Test Group (Safety Verification)</option>
                  </optgroup>
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ margin: 0 }}>Recipient Cohort Size</label>
                  <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600 }}>Meta Tier Limit: 2,000 Msg/24h</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="50000"
                  value={recipientsCount}
                  onChange={(e) => setRecipientsCount(Number(e.target.value))}
                  className="form-input"
                  style={{ marginTop: 4 }}
                />
                {recipientsCount > 2000 && (
                  <div style={{ marginTop: 6, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, color: '#DC2626', fontSize: '0.76rem', fontWeight: 600 }}>
                    ⚠️ Warning: Selected count ({recipientsCount}) exceeds Meta's current 2,000 daily message limit. We recommend targeting Batch 1 or Batch 2 (500 to 1,000 recipients).
                  </div>
                )}
              </div>

              {/* Estimate Box */}
              <div className="estimate-summary-box">
                <div className="estimate-row">
                  <span>Projected Meta API Cost:</span>
                  <strong>{formatCurrency(estCostNum, currency, 2)}</strong>
                </div>
                <div className="estimate-row">
                  <span>Projected Attributed Sales:</span>
                  <strong className="text-primary-brand">{formatCurrency(estRevenueNum, currency)}</strong>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Launch Broadcast</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
