import React, { useEffect, useMemo, useState } from 'react';
import { Campaign, Contact, Template, User } from '../types';
import { CurrencyCode, formatCurrency, formatRate } from '../lib/currency';
import { canCreateCampaigns } from '../lib/permissions';
import { getCampaignRecipientsApi } from '../lib/api';
import { csvCell, csvText, downloadCsv } from '../lib/csv';
import {
  failureReason,
  filterCount,
  RecipientRow,
  RecipientStatus,
  REPORT_CSV_HEADER,
  REPORT_FILTERS,
  reportCsvRow,
  STATUS_LABEL,
  STATUS_TONE,
} from '../lib/broadcastReport';
import {
  ALL_OPTED_IN,
  INTERNAL_TEST_GROUP,
  costPerMessageUSD,
  estimateCampaignCostUSD,
  resolveCampaignAudience,
  resolveCampaignRecipients,
} from '../lib/campaignAudience';
import { BATCH_SIZE, batchOptions, isBatchLikeTag, nextUnsentBatch } from '../lib/contactBatches';
import { BroadcastIcon, CloseIcon } from './WhatsAppIcons';
import { WaText } from './WaText';

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

/** Expanded row: the per-number report. Every number with its status from Meta's delivery receipts, why it failed,
 *  filters, search and a CSV download. Retry is only for server-sent broadcasts (the server does the resending). */
const REPORT_PAGE = 100;

const CampaignDetail: React.FC<{
  campaign: Campaign;
  canManage: boolean;
  onAction?: (id: string, action: BroadcastAction) => void;
}> = ({ campaign, canManage, onAction }) => {
  const p = campaign.progress!;
  const [filterKey, setFilterKey] = useState('all');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [limit, setLimit] = useState(REPORT_PAGE);
  const [page, setPage] = useState<{ items: RecipientRow[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const filter = REPORT_FILTERS.find(f => f.key === filterKey) || REPORT_FILTERS[0];
  const counts: Partial<Record<RecipientStatus, number>> = {
    QUEUED: p.queued, SENDING: p.sending, SENT: p.sent, DELIVERED: p.delivered, READ: p.read, FAILED: p.failed, CANCELLED: p.cancelled,
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => setLimit(REPORT_PAGE), [filterKey, debounced]);

  // Statuses keep changing as Meta's receipts arrive, so the open report refreshes itself.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await getCampaignRecipientsApi(campaign.id, { status: filter.statuses.join(','), q: debounced, limit });
        if (alive) {
          setPage(r as any);
          setError(null);
        }
      } catch (e: any) {
        if (alive) setError(e?.message || 'Could not load the report');
      }
    };
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [campaign.id, filter.key, debounced, limit, p.processed, p.delivered, p.read]);

  // Downloads everyone in the current view (filter and search), page by page.
  const download = async () => {
    setDownloading(true);
    try {
      const all: RecipientRow[] = [];
      for (let offset = 0; ; offset += 200) {
        const r: any = await getCampaignRecipientsApi(campaign.id, { status: filter.statuses.join(','), q: debounced, limit: 200, offset });
        all.push(...r.items);
        if (all.length >= r.total || r.items.length === 0) break;
      }
      const safe = campaign.name.replace(/[^\w-]+/g, '_').slice(0, 40);
      downloadCsv(
        `Broadcast_${safe}_${filter.key}_${new Date().toISOString().slice(0, 10)}.csv`,
        REPORT_CSV_HEADER,
        all.map(r => reportCsvRow(r).map((v, i) => (i === 0 ? csvText(v) : csvCell(v)))),
      );
    } catch (e: any) {
      alert(e?.message || 'The report could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  };

  const interrupted = !!page?.items.some(i => i.errorCode === 'INTERRUPTED');
  const chips: Array<[string, number, string]> = [
    ['Queued', p.queued + p.sending, ''],
    ['Sent, no receipt yet', p.sent, ''],
    ['Delivered', p.delivered, ''],
    ['Read', p.read, ''],
    ['Failed', p.failed, p.failed > 0 ? 'is-bad' : ''],
    ['Cancelled', p.cancelled, ''],
  ];
  const time = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

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

      {campaign.serverSend && p.failed > 0 && canManage && campaign.status !== 'CANCELLED' && onAction && (
        <div className="wa-bc-failed-head">
          <strong>{p.failed.toLocaleString()} failed</strong>
          <button type="button" className="wa-bc-act" onClick={() => onAction(campaign.id, 'retry-failed')}>
            Retry failed
          </button>
        </div>
      )}
      {interrupted && (
        <p className="wa-bc-muted">
          "INTERRUPTED" messages were being sent when the server stopped. They may already have been delivered, so retrying could message someone twice.
        </p>
      )}

      <div className="wa-bc-report-bar">
        <div className="wa-bc-report-tabs" role="tablist" aria-label="Show">
          {REPORT_FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filterKey === f.key}
              className={filterKey === f.key ? 'is-active' : ''}
              onClick={() => setFilterKey(f.key)}
            >
              {f.label} <span>{filterCount(f.statuses, counts).toLocaleString()}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          className="wa-bc-report-search"
          placeholder="Search name or number"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search the report"
        />
        <button type="button" className="wa-bc-act" onClick={download} disabled={downloading || !page || page.total === 0}>
          {downloading ? 'Preparing…' : 'Download CSV'}
        </button>
      </div>

      {error && <p className="wa-bc-muted">{error}</p>}
      {!page && !error && <p className="wa-bc-muted">Loading the report…</p>}
      {page && page.items.length === 0 && <p className="wa-bc-muted">No numbers in this view.</p>}
      {page && page.items.length > 0 && (
        <div className="wa-bc-report-scroll">
          <table className="wa-bc-report">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Delivered</th>
                <th>Read</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map(r => (
                <tr key={r.id}>
                  <td data-label="Contact">
                    <strong>{r.displayName && !r.displayName.startsWith('+') ? r.displayName : 'No name'}</strong>
                    <span className="wa-bc-muted">+{r.phone}</span>
                  </td>
                  <td data-label="Status">
                    <span className={`wa-bc-rstatus tone-${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status] || r.status}</span>
                  </td>
                  <td data-label="Sent">{time(r.sentAt)}</td>
                  <td data-label="Delivered">{time(r.deliveredAt)}</td>
                  <td data-label="Read">{time(r.readAt)}</td>
                  <td data-label="Reason" className="wa-bc-report-why">
                    {r.status === 'FAILED' ? failureReason(r.errorCode, r.errorMessage) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page && page.total > page.items.length && (
        <div className="wa-bc-report-more">
          <span className="wa-bc-muted">Showing {page.items.length.toLocaleString()} of {page.total.toLocaleString()}</span>
          <button type="button" className="wa-bc-act" onClick={() => setLimit(l => Math.min(l + REPORT_PAGE, 200))} disabled={limit >= 200}>
            {limit >= 200 ? 'Download the CSV for the rest' : 'Show more'}
          </button>
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

  // Extract all unique tags present across contacts in CRM (batches are listed separately below)
  const crmTags = Array.from(new Set(contacts.flatMap(c => c.tags || []))).filter(t => t && !isBatchLikeTag(t));

  // Batches of 500, with which ones already received the chosen template. "Sent" is per template: a new marketing
  // template starts again from Batch 1. The next batch without this template is offered first.
  const chosenTemplateName = (templates.find(t => t.id === selectedTemplateId) || templates[0])?.name;
  const batches = useMemo(
    () => batchOptions(contacts, campaigns, chosenTemplateName),
    [contacts, campaigns, chosenTemplateName],
  );
  const nextBatch = nextUnsentBatch(batches);

  const [selectedTag, setSelectedTag] = useState(() => nextBatch?.tag || crmTags[0] || ALL_OPTED_IN);
  const selectedBatch = batches.find(b => b.tag === selectedTag);

  // Choosing another template moves a batch audience to the next batch that has not had that template.
  useEffect(() => {
    if (isModalOpen && isBatchLikeTag(selectedTag) && nextBatch) setSelectedTag(nextBatch.tag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId]);

  // Recipients are always the real, opted-in audience: the same list the dispatcher will message.
  // People Meta recently refused to deliver to are left out (they rest for a while), and we say how many.
  const audience = resolveCampaignAudience(contacts, [selectedTag]);
  const recipientsCount = audience.recipients.length;
  const restingCount = audience.skipped.length;
  const notOptedInCount = selectedBatch ? selectedBatch.members - recipientsCount - restingCount : 0;
  const countFor = (tag: string) => resolveCampaignRecipients(contacts, [tag]).length;

  const canCreate = canCreateCampaigns(currentUser?.role);

  // Top cards: only measured broadcasts count (per-number records updated by Meta's receipts). Older broadcasts only
  // have numbers estimated at launch, so they are left out rather than shown as if real.
  const measured = campaigns.filter(c => c.progress);
  const unmeasuredCount = campaigns.length - measured.length;
  const sum = (f: (p: NonNullable<Campaign['progress']>) => number) => measured.reduce((n, c) => n + f(c.progress!), 0);
  const totalAccepted = sum(p => p.accepted);
  const totalDelivered = sum(p => p.delivered + p.read);
  const totalRead = sum(p => p.read);
  const totalFailed = sum(p => p.failed);
  const totalAttempted = totalAccepted + totalFailed;

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
      // Nothing is guessed: delivered / read / failed come from Meta's receipts once the sends are recorded.
      stats: {
        sent: 0,
        delivered: 0,
        read: 0,
        clickedOrReplied: 0,
        converted: 0,
        failed: 0,
        revenue: 0,
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

  const openModal = () => {
    if (nextBatch) setSelectedTag(nextBatch.tag);
    setIsModalOpen(true);
  };

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
            <span className="wa-bc-kpi-label">Messages sent</span>
            <strong className="wa-bc-kpi-value is-brand">{totalAccepted.toLocaleString()}</strong>
            <span className="wa-bc-kpi-foot">
              Accepted by Meta, from {measured.length} measured {measured.length === 1 ? 'broadcast' : 'broadcasts'}
              {unmeasuredCount > 0 ? ` (${unmeasuredCount} older not measured)` : ''}
            </span>
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
            <span className="wa-bc-kpi-label">Delivered</span>
            <strong className="wa-bc-kpi-value">{totalDelivered.toLocaleString()}</strong>
            <span className="wa-bc-kpi-foot">{pct(totalDelivered, totalAccepted).toFixed(1)}% of sent, from Meta's receipts</span>
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
            <span className="wa-bc-kpi-label">Read</span>
            <strong className="wa-bc-kpi-value">{totalRead.toLocaleString()}</strong>
            <span className="wa-bc-kpi-foot">{pct(totalRead, totalDelivered).toFixed(1)}% of delivered (people with read receipts on)</span>
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
            <span className="wa-bc-kpi-label">Failed</span>
            <strong className="wa-bc-kpi-value">{totalFailed.toLocaleString()}</strong>
            <span className="wa-bc-kpi-foot">{pct(totalFailed, totalAttempted).toFixed(1)}% of attempts; open a broadcast's Report to see who and why</span>
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
                // Measured broadcasts have one record per number, updated by Meta's receipts; older ones do not.
                const p = cmp.progress;
                const waitingForLimit = !!p && cmp.status === 'SENDING' && cmp.pauseReason === 'DAILY_LIMIT';
                const meta = waitingForLimit
                  ? { label: 'Waiting: daily limit', tone: 'live' as const }
                  : STATUS_META[cmp.status] || STATUS_META.SCHEDULED;
                // Pause / resume / cancel only exist for broadcasts the server sends.
                const serverActive = !!cmp.serverSend && (cmp.status === 'SENDING' || cmp.status === 'PAUSED');
                const readPct = p ? pct(p.read, p.delivered + p.read) : 0;
                const notMeasuredTitle =
                  'Sent before per-number reports existed: only an estimate made at launch was kept, so no figures are shown.';

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
                            {canCreate && onCampaignAction && serverActive && cmp.status === 'SENDING' && (
                              <button type="button" className="wa-bc-act" onClick={() => onCampaignAction(cmp.id, 'pause')}>
                                Pause
                              </button>
                            )}
                            {canCreate && onCampaignAction && serverActive && cmp.status === 'PAUSED' && (
                              <button type="button" className="wa-bc-act is-primary" onClick={() => onCampaignAction(cmp.id, 'resume')}>
                                Resume
                              </button>
                            )}
                            {canCreate && onCampaignAction && serverActive && (
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
                              {expandedId === cmp.id ? 'Hide report' : 'Report'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="wa-bc-delivery">
                            <strong>{(cmp.totalRecipients || cmp.stats.sent).toLocaleString()}</strong>
                            <span> numbers</span>
                          </div>
                          <span className="wa-bc-est" title={notMeasuredTitle}>
                            Not measured
                          </span>
                        </>
                      )}
                    </td>
                    <td data-label="Engagement">
                      {p ? (
                        <>
                          <div className="wa-bc-eng">
                            <strong>{p.read.toLocaleString()}</strong>
                            <span> read · {readPct.toFixed(1)}%</span>
                          </div>
                          <div className="wa-bc-eng wa-bc-muted" title="Replies are not linked to a broadcast yet.">Replies: not tracked yet</div>
                        </>
                      ) : (
                        <div className="wa-bc-muted" title={notMeasuredTitle}>Not measured</div>
                      )}
                    </td>
                    <td data-label="Sales">
                      {p ? (
                        <div className="wa-bc-muted" title="Order attribution is not connected to broadcasts yet.">Not tracked yet</div>
                      ) : (
                        <div className="wa-bc-muted" title={notMeasuredTitle}>Not measured</div>
                      )}
                    </td>
                    <td data-label="Meta spend">
                      {p ? (
                        <div
                          className="wa-bc-spend"
                          title="Meta charges a marketing template when it is delivered: delivered messages × Meta's rate. Your Meta invoice is the final word."
                        >
                          {formatCurrency(cmp.stats.cost, currency, 2)}
                        </div>
                      ) : (
                        <div className="wa-bc-muted" title={notMeasuredTitle}>Not measured</div>
                      )}
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
                      {String(previewTemplate.bodyJson.header?.type || '').toUpperCase() === 'IMAGE' && (
                        <img
                          className="wa-bc-bubble-img"
                          src={`/api/whatsapp/media/template/${encodeURIComponent(previewTemplate.name)}`}
                          alt="Template image"
                          onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      {previewTemplate.bodyJson.header?.type === 'TEXT' && previewTemplate.bodyJson.header.text && (
                        <div className="wa-bc-bubble-head">{previewTemplate.bodyJson.header.text}</div>
                      )}
                      <div className="wa-bc-bubble-body"><WaText text={previewTemplate.bodyJson.body} /></div>
                      {previewTemplate.bodyJson.footer && (
                        <div className="wa-bc-bubble-foot">{previewTemplate.bodyJson.footer}</div>
                      )}
                    </div>
                    {Array.isArray(previewTemplate.bodyJson.buttons) && previewTemplate.bodyJson.buttons.length > 0 && (
                      <div className="wa-bc-bubble-btns">
                        {previewTemplate.bodyJson.buttons.map((b: any, i: number) => (
                          <div key={i} className="wa-bc-bubble-btn">{b?.text || b}</div>
                        ))}
                      </div>
                    )}
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

                  <optgroup label={`Batches (${BATCH_SIZE} contacts each)`}>
                    {batches.length === 0 ? (
                      <option value="" disabled>No batches yet: add contacts first</option>
                    ) : (
                      batches.map(b => (
                        <option key={b.tag} value={b.tag}>
                          {b.label} ({b.reachable === b.members
                            ? `${b.members.toLocaleString()} ${b.members === 1 ? 'contact' : 'contacts'}`
                            : `${b.reachable.toLocaleString()} of ${b.members.toLocaleString()} reachable now`})
                          {b.sentWith.length > 0 ? ' · sent this template' : b.tag === nextBatch?.tag ? ' · next' : ''}
                        </option>
                      ))
                    )}
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
                {selectedBatch && selectedBatch.reachable < selectedBatch.members && (
                  <p className="wa-bc-batch-note">
                    {selectedBatch.label.split(' · ')[0]} still has all its {selectedBatch.members.toLocaleString()} people (batches never
                    change). {(selectedBatch.members - selectedBatch.reachable).toLocaleString()} are left out of this send:{' '}
                    {[
                      restingCount > 0 ? `${restingCount.toLocaleString()} resting after Meta refused to deliver to them` : '',
                      notOptedInCount > 0 ? `${notOptedInCount.toLocaleString()} not opted in` : '',
                    ].filter(Boolean).join(', ')}.
                  </p>
                )}
                {selectedBatch && selectedBatch.sentWith.length > 0 && (
                  <div className="wa-bc-warn" role="alert">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>
                      This batch already received this template (
                      {selectedBatch.sentWith
                        .map(s => `"${s.name}"${s.at ? ` on ${new Date(s.at).toLocaleDateString([], { day: 'numeric', month: 'short' })}` : ''}`)
                        .join(', ')}
                      ).
                      {nextBatch
                        ? ` The next batch that has not had it is ${nextBatch.label.split(' · ')[0]}.`
                        : ' Every batch has had this template.'}
                    </span>
                  </div>
                )}
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
                      {recipientsCount.toLocaleString()} exceeds Meta's current 2,000 daily message limit. Send to one batch at a time instead ({BATCH_SIZE} contacts each).
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
