import React, { useEffect, useState } from 'react';
import { Campaign, Contact, Template, User } from '../types';
import { CurrencyCode, formatCurrency, formatRate } from '../lib/currency';
import { canCreateCampaigns } from '../lib/permissions';
import { getCampaignRecipientsApi } from '../lib/api';
import {
  ALL_OPTED_IN,
  INTERNAL_TEST_GROUP,
  costPerMessageUSD,
  estimateCampaignCostUSD,
  resolveCampaignAudience,
  resolveCampaignRecipients,
} from '../lib/campaignAudience';
import { BroadcastIcon, CloseIcon } from './WhatsAppIcons';

interface CampaignsViewProps {
  campaigns: Campaign[];
  templates: Template[];
  contacts?: Contact[];
  currency?: CurrencyCode;
  currentUser?: User | null;
  onLaunchCampaign: (campaign: Campaign) => void;
  /** True when the server owns sending, so the modal can say the tab may be closed. */
  serverSendEnabled?: boolean;
  onCampaignAction?: (id: string, action: BroadcastAction) => void;
}

type BroadcastAction = 'pause' | 'resume' | 'cancel' | 'retry-failed';

const STATUS_META: Record<string, { label: string; tone: 'done' | 'live' | 'idle' | 'fail' }> = {
  COMPLETED: { label: 'Completed', tone: 'done' },
  SENDING: { label: 'In progress', tone: 'live' },
  PAUSED: { label: 'Paused', tone: 'idle' },
  SCHEDULED: { label: 'Scheduled', tone: 'idle' },
  DRAFT: { label: 'Draft', tone: 'idle' },
  FAILED: { label: 'Failed', tone: 'fail' },
  CANCELLED: { label: 'Cancelled', tone: 'idle' },
};

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** Segmented bar: read / delivered / sent (accepted, awaiting receipt) / failed, out of everyone in the audience. */
const ProgressBar: React.FC<{ p: NonNullable<Campaign['progress']> }> = ({ p }) => {
  const w = (n: number) => `${pct(n, p.total)}%`;
  return (
    <div
      className="wa-bc-bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p.percentDone)}
      aria-label="Broadcast progress"
    >
      <div className="wa-bc-seg is-read" style={{ width: w(p.read) }} title={`${p.read} read`} />
      <div className="wa-bc-seg is-delivered" style={{ width: w(p.delivered) }} title={`${p.delivered} delivered`} />
      <div className="wa-bc-seg is-sent" style={{ width: w(p.sent) }} title={`${p.sent} sent, awaiting delivery receipt`} />
      <div className="wa-bc-seg is-failed" style={{ width: w(p.failed) }} title={`${p.failed} failed`} />
    </div>
  );
};

/** Expanded row: exact counts per stage, plus who failed and why, with an explicit retry. */
const CampaignDetail: React.FC<{
  campaign: Campaign;
  canManage: boolean;
  onAction?: (id: string, action: BroadcastAction) => void;
}> = ({ campaign, canManage, onAction }) => {
  const p = campaign.progress!;
  const [failed, setFailed] = useState<{ items: any[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await getCampaignRecipientsApi(campaign.id, { status: 'FAILED', limit: 50 });
        if (alive) {
          setFailed(r);
          setError(null);
        }
      } catch (e: any) {
        if (alive) setError(e?.message || 'Could not load failed recipients');
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [campaign.id, p.failed]);

  const interrupted = !!failed?.items.some(i => i.errorCode === 'INTERRUPTED');
  const chips: Array<[string, number, string]> = [
    ['Queued', p.queued + p.sending, ''],
    ['Sent', p.sent, ''],
    ['Delivered', p.delivered, ''],
    ['Read', p.read, ''],
    ['Failed', p.failed, p.failed > 0 ? 'is-bad' : ''],
    ['Cancelled', p.cancelled, ''],
  ];

  return (
    <div className="wa-bc-detail">
      <div className="wa-bc-chips">
        {chips.map(([label, n, tone]) => (
          <div key={label} className={`wa-bc-chip ${tone}`}>
            <strong>{n.toLocaleString()}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {campaign.pauseReason === 'DAILY_LIMIT' && (
        <div className="wa-bc-warn" role="status">
          Waiting: today's WhatsApp messaging limit was reached. Sending continues automatically when Meta's 24-hour window frees up.
        </div>
      )}

      {p.failed > 0 && (
        <div className="wa-bc-failed">
          <div className="wa-bc-failed-head">
            <strong>{p.failed.toLocaleString()} failed</strong>
            {canManage && campaign.status !== 'CANCELLED' && onAction && (
              <button type="button" className="wa-bc-act" onClick={() => onAction(campaign.id, 'retry-failed')}>
                Retry failed
              </button>
            )}
          </div>
          {interrupted && (
            <p className="wa-bc-muted">
              "INTERRUPTED" messages were being sent when the server stopped. They may already have been delivered, so retrying could message someone twice.
            </p>
          )}
          {error && <p className="wa-bc-muted">{error}</p>}
          {failed && (
            <ul className="wa-bc-failed-list">
              {failed.items.map(i => (
                <li key={i.id}>
                  <span className="wa-bc-failed-who">{i.displayName && !i.displayName.startsWith('+') ? i.displayName : `+${i.phone}`}</span>
                  <span className="wa-bc-failed-why">{i.errorCode ? `${i.errorCode}: ` : ''}{i.errorMessage || 'Failed'}</span>
                </li>
              ))}
              {failed.total > failed.items.length && (
                <li className="wa-bc-muted">Showing {failed.items.length} of {failed.total.toLocaleString()}.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const KpiIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  templates,
  contacts = [],
  currency = 'INR',
  currentUser,
  onLaunchCampaign,
  serverSendEnabled = false,
  onCampaignAction,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || '');

  // Extract all unique tags present across contacts in CRM
  const crmTags = Array.from(new Set(contacts.flatMap(c => c.tags || []))).filter(Boolean);

  const [selectedTag, setSelectedTag] = useState(crmTags[0] || ALL_OPTED_IN);

  // Recipients are always the real, opted-in audience: the same list the dispatcher will message.
  // People Meta recently refused to deliver to are left out (they rest for a while), and we say how many.
  const audience = resolveCampaignAudience(contacts, [selectedTag]);
  const recipientsCount = audience.recipients.length;
  const restingCount = audience.skipped.length;
  const countFor = (tag: string) => resolveCampaignRecipients(contacts, [tag]).length;

  const canCreate = canCreateCampaigns(currentUser?.role);

  const totalCampaignRevenue = campaigns.reduce((acc, c) => acc + c.stats.revenue, 0);
  const totalCampaignCost = campaigns.reduce((acc, c) => acc + c.stats.cost, 0);
  const totalSent = campaigns.reduce((acc, c) => acc + c.stats.sent, 0);
  const totalConverted = campaigns.reduce((acc, c) => acc + c.stats.converted, 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim() || recipientsCount === 0) return;

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
        cost: Number(estimateCampaignCostUSD(recipientsCount, chosenTemplate.category).toFixed(4)),
      },
    };

    onLaunchCampaign(newCampaign);
    setIsModalOpen(false);
    setCampaignName('');
  };

  // The template the modal is currently pointing at (same fallback rule as handleCreate)
  const previewTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  const estCostNum = estimateCampaignCostUSD(recipientsCount, previewTemplate?.category);
  const estRevenueNum = recipientsCount * 0.09 * 145;

  const openModal = () => setIsModalOpen(true);

  return (
    <div className="wa-bc-page">
      {/* Toolbar */}
      <div className="wa-bc-toolbar">
        <p className="wa-bc-lede">
          Reach opted-in customers at scale with approved WhatsApp templates.
        </p>
        {canCreate && (
          <button type="button" className="wa-bc-primary" onClick={openModal}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New broadcast
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="wa-bc-kpis">
        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-green">
            <KpiIcon>
              <path d="M3 17l6-6 4 4 8-8" />
              <path d="M14 7h7v7" />
            </KpiIcon>
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">Broadcast Attributed Sales</span>
            <strong className="wa-bc-kpi-value is-brand">{formatCurrency(totalCampaignRevenue, currency)}</strong>
            <span className="wa-bc-kpi-foot">Generated from {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}</span>
          </div>
        </div>

        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-teal">
            <KpiIcon>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </KpiIcon>
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">Completed Orders</span>
            <strong className="wa-bc-kpi-value">{totalConverted.toLocaleString()}</strong>
            <span className="wa-bc-kpi-foot">{totalSent > 0 ? ((totalConverted / totalSent) * 100).toFixed(1) : '0'}% overall conversion</span>
          </div>
        </div>

        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-amber">
            <KpiIcon>
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </KpiIcon>
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">Total Outbound Cost</span>
            <strong className="wa-bc-kpi-value">{formatCurrency(totalCampaignCost, currency)}</strong>
            <span className="wa-bc-kpi-foot">{formatCurrency(totalConverted > 0 ? totalCampaignCost / totalConverted : 0, currency, 2)} cost per order</span>
          </div>
        </div>

        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-slate">
            <KpiIcon>
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </KpiIcon>
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">Campaign ROI Multiple</span>
            <strong className="wa-bc-kpi-value">{totalCampaignCost > 0 ? (totalCampaignRevenue / totalCampaignCost).toFixed(1) : '0.0'}x</strong>
            <span className="wa-bc-kpi-foot">Gross revenue return</span>
          </div>
        </div>
      </div>

      {/* History */}
      <section className="wa-bc-card">
        <div className="wa-bc-card-head">
          <h3 className="wa-bc-card-title">Broadcast history</h3>
          <span className="wa-bc-count">{campaigns.length} total</span>
        </div>

        {campaigns.length === 0 ? (
          <div className="wa-bc-empty">
            <div className="wa-bc-empty-icon">
              <BroadcastIcon size={30} color="#008069" />
            </div>
            <h4>No broadcasts sent yet</h4>
            <p>
              Send an approved template to a verified opt-in audience. Delivery, reads and replies will show up here.
            </p>
            {canCreate && (
              <button type="button" className="wa-bc-primary" onClick={openModal}>
                Send your first broadcast
              </button>
            )}
          </div>
        ) : (
          <table className="wa-bc-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Delivery</th>
                <th>Engagement</th>
                <th>Sales</th>
                <th>Meta spend</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((cmp) => {
                const p = cmp.serverSend ? cmp.progress : undefined;
                const waitingForLimit = !!p && cmp.status === 'SENDING' && cmp.pauseReason === 'DAILY_LIMIT';
                const meta = waitingForLimit
                  ? { label: 'Waiting: daily limit', tone: 'live' as const }
                  : STATUS_META[cmp.status] || STATUS_META.SCHEDULED;
                const active = cmp.status === 'SENDING' || cmp.status === 'PAUSED';
                const deliveryPct = pct(cmp.stats.delivered, cmp.stats.sent);
                const openPct = pct(cmp.stats.read, cmp.stats.delivered);
                const ctrPct = pct(cmp.stats.clickedOrReplied, cmp.stats.read);

                return (
                  <React.Fragment key={cmp.id}>
                  <tr>
                    <td data-label="Campaign">
                      <div className="wa-bc-name">{cmp.name}</div>
                      <div className="wa-bc-template">{cmp.templateName}</div>
                      {cmp.targetTags.length > 0 && (
                        <div className="wa-bc-tags">
                          {cmp.targetTags.map((t, i) => (
                            <span key={i} className="wa-bc-tag">{t}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td data-label="Status">
                      <span className={`wa-bc-status tone-${meta.tone}`}>
                        <span className="wa-bc-status-dot" />
                        {meta.label}
                      </span>
                    </td>
                    <td data-label="Delivery">
                      {p ? (
                        <>
                          <div className="wa-bc-delivery">
                            <strong>{p.accepted.toLocaleString()}</strong>
                            <span> / {p.total.toLocaleString()} sent</span>
                          </div>
                          <ProgressBar p={p} />
                          <div className="wa-bc-muted">
                            {p.percentDone.toFixed(1)}% processed
                            {p.failed > 0 ? ` · ${p.failed.toLocaleString()} failed` : ''}
                            {p.cancelled > 0 ? ` · ${p.cancelled.toLocaleString()} cancelled` : ''}
                          </div>
                          <div className="wa-bc-actions">
                            {canCreate && onCampaignAction && cmp.status === 'SENDING' && (
                              <button type="button" className="wa-bc-act" onClick={() => onCampaignAction(cmp.id, 'pause')}>
                                Pause
                              </button>
                            )}
                            {canCreate && onCampaignAction && cmp.status === 'PAUSED' && (
                              <button type="button" className="wa-bc-act is-primary" onClick={() => onCampaignAction(cmp.id, 'resume')}>
                                Resume
                              </button>
                            )}
                            {canCreate && onCampaignAction && active && (
                              <button
                                type="button"
                                className="wa-bc-act is-danger"
                                onClick={() => {
                                  if (window.confirm('Cancel this broadcast? Messages already sent stay sent. The remaining recipients will not be messaged.')) {
                                    onCampaignAction(cmp.id, 'cancel');
                                  }
                                }}
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              type="button"
                              className="wa-bc-act"
                              aria-expanded={expandedId === cmp.id}
                              onClick={() => setExpandedId(prev => (prev === cmp.id ? null : cmp.id))}
                            >
                              {expandedId === cmp.id ? 'Hide details' : 'Details'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="wa-bc-delivery">
                            <strong>{cmp.stats.delivered.toLocaleString()}</strong>
                            <span> / {cmp.stats.sent.toLocaleString()}</span>
                          </div>
                          <div className="wa-bc-bar" role="presentation">
                            <div className="wa-bc-bar-fill" style={{ width: `${Math.min(100, deliveryPct)}%` }} />
                          </div>
                          <div className="wa-bc-muted">{deliveryPct.toFixed(1)}% delivered</div>
                          <span
                            className="wa-bc-est"
                            title="These figures were estimated when the broadcast was launched, not measured from Meta's delivery receipts."
                          >
                            Estimated
                          </span>
                        </>
                      )}
                    </td>
                    <td data-label="Engagement">
                      <div className="wa-bc-eng">
                        <strong>{cmp.stats.read.toLocaleString()}</strong>
                        <span> opened · {openPct.toFixed(1)}%</span>
                      </div>
                      {p ? (
                        <div className="wa-bc-eng wa-bc-muted" title="Replies are not linked to a broadcast yet.">Replies: not tracked yet</div>
                      ) : (
                        <div className="wa-bc-eng">
                          <strong>{cmp.stats.clickedOrReplied.toLocaleString()}</strong>
                          <span> CTR · {ctrPct.toFixed(1)}%</span>
                        </div>
                      )}
                    </td>
                    <td data-label="Sales">
                      {p ? (
                        <div className="wa-bc-muted" title="Order attribution is not connected to broadcasts yet.">Not tracked yet</div>
                      ) : (
                        <>
                          <div className="wa-bc-sales">{formatCurrency(cmp.stats.revenue, currency)}</div>
                          <div className="wa-bc-muted">{cmp.stats.converted.toLocaleString()} orders</div>
                        </>
                      )}
                    </td>
                    <td data-label="Meta spend">
                      <div className="wa-bc-spend">{formatCurrency(cmp.stats.cost, currency, 2)}</div>
                    </td>
                  </tr>
                  {p && expandedId === cmp.id && (
                    <tr className="wa-bc-detail-row">
                      <td colSpan={6}>
                        <CampaignDetail campaign={cmp} canManage={canCreate} onAction={onCampaignAction} />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* New Broadcast Modal */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="wa-modal-card" style={{ maxWidth: 560, width: '92%' }}>
            <div className="wa-modal-header">
              <div>
                <h3 className="wa-modal-title">New broadcast</h3>
                <p className="wa-modal-subtitle">Send an approved template to an audience segment</p>
              </div>
              <button
                type="button"
                className="wa-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <CloseIcon size={18} color="#54656f" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="wa-modal-form">
              <div className="wa-form-group">
                <label className="wa-form-label" htmlFor="wa-bc-name">Campaign name</label>
                <input
                  id="wa-bc-name"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. VIP Fall Collection Launch"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="wa-modal-input"
                />
              </div>

              <div className="wa-form-group">
                <label className="wa-form-label" htmlFor="wa-bc-template">Message template</label>
                <select
                  id="wa-bc-template"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="wa-modal-input"
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

                {previewTemplate?.bodyJson?.body && (
                  <div className="wa-bc-preview" aria-label="Template preview">
                    <div className="wa-bc-bubble">
                      {previewTemplate.bodyJson.header?.type === 'TEXT' && previewTemplate.bodyJson.header.text && (
                        <div className="wa-bc-bubble-head">{previewTemplate.bodyJson.header.text}</div>
                      )}
                      <div className="wa-bc-bubble-body">{previewTemplate.bodyJson.body}</div>
                      {previewTemplate.bodyJson.footer && (
                        <div className="wa-bc-bubble-foot">{previewTemplate.bodyJson.footer}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="wa-form-group">
                <label className="wa-form-label" htmlFor="wa-bc-audience">Audience</label>
                <select
                  id="wa-bc-audience"
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="wa-modal-input"
                >
                  <optgroup label="Contact tags">
                    {crmTags.length === 0 ? (
                      <option value="New Lead">New Lead Tag (0 contacts)</option>
                    ) : (
                      crmTags.map(t => {
                        const count = countFor(t);
                        return (
                          <option key={t} value={t}>
                            Tag: {t} ({count} {count === 1 ? 'contact' : 'contacts'})
                          </option>
                        );
                      })
                    )}
                  </optgroup>

                  <optgroup label="Batch segments (safety limit)">
                    <option value="Batch 1: Contacts 1 - 500">Batch 1: Contacts 1 - 500 ({countFor('Batch 1: Contacts 1 - 500')} contacts)</option>
                    <option value="Batch 2: Contacts 501 - 1000">Batch 2: Contacts 501 - 1,000 ({countFor('Batch 2: Contacts 501 - 1000')} contacts)</option>
                    <option value="Batch 3: Contacts 1001 - 2000">Batch 3: Contacts 1,001 - 2,000 ({countFor('Batch 3: Contacts 1001 - 2000')} contacts)</option>
                    <option value="Batch 4: Contacts 2001 - 3000">Batch 4: Contacts 2,001 - 3,000 ({countFor('Batch 4: Contacts 2001 - 3000')} contacts)</option>
                  </optgroup>

                  <optgroup label="Global database">
                    <option value={ALL_OPTED_IN}>All opted-in contacts ({countFor(ALL_OPTED_IN)} of {contacts.length})</option>
                    <option value={INTERNAL_TEST_GROUP}>Internal team test group ({countFor(INTERNAL_TEST_GROUP)} tagged "Internal Team")</option>
                  </optgroup>
                </select>
              </div>

              <div className="wa-form-group">
                <div className="wa-bc-label-row">
                  <span className="wa-form-label">Recipients</span>
                  <span className="wa-bc-limit">Meta tier limit: 2,000 messages / 24h</span>
                </div>
                <div className={`wa-bc-audience ${recipientsCount === 0 ? 'is-empty' : ''}`} aria-live="polite">
                  <strong>{recipientsCount.toLocaleString()}</strong>
                  <span>
                    {recipientsCount === 0
                      ? restingCount > 0
                        ? 'Everyone in this audience is resting because Meta recently refused to deliver to them. Choose another audience, or try again later.'
                        : 'No opted-in contacts match this audience. Add or import contacts first.'
                      : `opted-in ${recipientsCount === 1 ? 'contact' : 'contacts'} will receive this broadcast`}
                  </span>
                </div>
                {restingCount > 0 && recipientsCount > 0 && (
                  <div className="wa-bc-warn" role="note">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>
                      {restingCount.toLocaleString()} {restingCount === 1 ? 'person is' : 'people are'} left out because Meta recently refused to deliver to them. They are included again automatically when their rest period ends.
                    </span>
                  </div>
                )}
                {recipientsCount > 2000 && (
                  <div className="wa-bc-warn" role="alert">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>
                      {recipientsCount.toLocaleString()} exceeds Meta's current 2,000 daily message limit. Target Batch 1 or Batch 2 (500 to 1,000 recipients) instead.
                    </span>
                  </div>
                )}
              </div>

              <div className="wa-bc-estimate">
                <div className="wa-bc-estimate-row">
                  <span>
                    Estimated Meta cost
                    <em className="wa-bc-rate"> at {formatRate(costPerMessageUSD(previewTemplate?.category), currency, 3)} per message</em>
                  </span>
                  <strong>{formatCurrency(estCostNum, currency, 2)}</strong>
                </div>
                <div className="wa-bc-estimate-row">
                  <span>
                    Illustrative sales
                    <em className="wa-bc-rate"> assumes 9% conversion at 145 per order</em>
                  </span>
                  <strong className="is-brand">{formatCurrency(estRevenueNum, currency)}</strong>
                </div>
              </div>

              <p className="wa-bc-mode">
                {serverSendEnabled
                  ? 'Sending runs on the server. You can close this page and track progress here.'
                  : 'Sending runs from this browser tab. Keep it open until it finishes.'}
              </p>

              <div className="wa-modal-actions">
                <button type="button" className="wa-modal-cancel-btn" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="wa-modal-submit-btn" disabled={!campaignName.trim() || recipientsCount === 0}>
                  {recipientsCount > 0 ? `Send to ${recipientsCount.toLocaleString()} ${recipientsCount === 1 ? 'contact' : 'contacts'}` : 'Send broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
