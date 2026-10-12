import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TabType } from './Sidebar';
import { CallLeadHistoryEntry, CallLeadRow, CallOverview, CallStatus, ReplyRule } from '../types';
import {
  getCallLeadHistoryApi,
  getCallOverviewApi,
  getReplyRuleLeadsApi,
  getReplyRulesApi,
  updateCallLeadApi,
} from '../lib/api';
import {
  CALL_STATUS_HINT,
  CALL_STATUS_LABEL,
  CALL_STATUS_ORDER,
  CALL_STATUS_TONE,
  ROLE_LABEL,
  countByStatus,
  personName,
  sortCallLeads,
  tappedAgain,
} from '../lib/callStatus';
import { csvCell, csvText, downloadCsv } from '../lib/csv';

interface CallSheetsViewProps {
  /** Only passed to people who can open the Automations page, where rules are set up. */
  onNavigate?: (tab: TabType) => void;
  /** Team activity (everyone's call updates) is for managers; support agents see the sheets only. */
  showTeamActivity?: boolean;
}

const REFRESH_MS = 30000; // so people working the same sheet see each other's updates
const PAGE = 100;
const REMARK_MAX = 500;
const NOBODY = '__nobody__';
const PERIODS = [
  { days: 1, label: 'Last 24 hours' },
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
] as const;

const dt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'call_sheet';

const StatusPill: React.FC<{ status: CallStatus }> = ({ status }) => (
  <span className={`wa-bc-status tone-${CALL_STATUS_TONE[status]}`}>
    <span className="wa-bc-status-dot" />
    {CALL_STATUS_LABEL[status]}
  </span>
);

const Icon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto' }}>
    {children}
  </svg>
);

export const CallSheetsView: React.FC<CallSheetsViewProps> = ({ onNavigate, showTeamActivity = true }) => {
  const [view, setView] = useState<'sheets' | 'team'>('sheets');

  // ---- rules and the selected rule's sheet
  const [rules, setRules] = useState<ReplyRule[] | null>(null);
  const [ruleId, setRuleId] = useState<string>('');
  const [leads, setLeads] = useState<CallLeadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestRule = useRef('');

  // ---- filters
  const [statusFilter, setStatusFilter] = useState<CallStatus | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [byFilter, setByFilter] = useState('');
  const [shown, setShown] = useState(PAGE);

  // ---- update dialog
  const [editing, setEditing] = useState<CallLeadRow | null>(null);
  const [formStatus, setFormStatus] = useState<CallStatus>('CALL_PENDING');
  const [formRemarks, setFormRemarks] = useState('');
  const [history, setHistory] = useState<CallLeadHistoryEntry[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- team activity
  const [days, setDays] = useState<number>(7);
  const [overview, setOverview] = useState<CallOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      const list = await getReplyRulesApi();
      setRules(list);
      setError(null);
      setRuleId(prev => prev || (list.find(r => r.leadCount > 0) || list[0])?.id || '');
    } catch (e: any) {
      setError(e?.message || 'Could not load your rules.');
    }
  }, []);

  const loadLeads = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const rows = await getReplyRuleLeadsApi(id);
      if (latestRule.current === id) {
        setLeads(rows);
        setError(null);
      }
    } catch (e: any) {
      if (latestRule.current === id) setError(e?.message || 'Could not load this call sheet.');
    }
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await getCallOverviewApi(days));
      setOverviewError(null);
    } catch (e: any) {
      setOverviewError(e?.message || 'Could not load team activity.');
    }
  }, [days]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  useEffect(() => {
    latestRule.current = ruleId;
    setLeads(null);
    setStatusFilter('ALL');
    setQuery('');
    setByFilter('');
    setShown(PAGE);
    if (ruleId) loadLeads(ruleId);
  }, [ruleId, loadLeads]);

  useEffect(() => {
    if (view === 'team') loadOverview();
  }, [view, loadOverview]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadRules();
      if (view === 'sheets' && latestRule.current) loadLeads(latestRule.current);
      if (view === 'team') loadOverview();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [view, loadRules, loadLeads, loadOverview]);

  const rule = rules?.find(r => r.id === ruleId) || null;
  const counts = useMemo(() => countByStatus(leads || []), [leads]);
  const updaters = useMemo(
    () => Array.from(new Set((leads || []).map(l => l.updatedBy).filter((x): x is string => !!x))).sort(),
    [leads],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortCallLeads(leads || []).filter(l => {
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
      if (byFilter === NOBODY && l.updatedBy) return false;
      if (byFilter && byFilter !== NOBODY && l.updatedBy !== byFilter) return false;
      if (!q) return true;
      const digitsOnly = q.replace(/\D/g, '');
      return (
        personName(l.contact).toLowerCase().includes(q) ||
        (digitsOnly !== '' && l.contact.phone.includes(digitsOnly)) ||
        (l.remarks || '').toLowerCase().includes(q)
      );
    });
  }, [leads, statusFilter, byFilter, query]);

  const total = leads?.length || 0;
  const donePct = total > 0 ? Math.round((counts.CALL_DONE / total) * 100) : 0;

  // ---- update dialog
  const openUpdate = (row: CallLeadRow) => {
    setEditing(row);
    setFormStatus(row.status);
    setFormRemarks('');
    setFormError(null);
    setHistory(null);
    getCallLeadHistoryApi(row.id).then(setHistory).catch(() => setHistory([]));
  };

  const closeUpdate = () => {
    if (!saving) setEditing(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (formStatus === editing.status && !formRemarks.trim()) {
      setFormError('Choose a different status, or add a remark.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await updateCallLeadApi(editing.id, { status: formStatus, remarks: formRemarks });
      setLeads(prev => (prev || []).map(l => (l.id === res.id ? { ...l, status: res.status, remarks: res.remarks, updatedAt: res.updatedAt, updatedBy: res.updatedBy } : l)));
      setEditing(null);
      loadRules();
    } catch (err: any) {
      setFormError(err?.message || 'Could not save the update.');
    } finally {
      setSaving(false);
    }
  };

  // ---- download exactly what is on screen
  const download = () => {
    if (!rule || visible.length === 0) return;
    downloadCsv(
      `${slug(rule.name)}_call_sheet_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'WhatsApp number', 'Button tapped', 'Template', 'First tapped', 'Last tapped', 'Times tapped', 'Call status', 'Remarks', 'Last updated by', 'Last updated on'],
      visible.map(l => [
        csvText(l.contact.displayName || ''),
        csvCell(l.contact.phone),
        csvText(l.buttonText),
        csvText(l.templateName || ''),
        csvCell(new Date(l.firstTapAt).toLocaleString()),
        csvCell(new Date(l.lastTapAt).toLocaleString()),
        String(l.tapCount),
        csvCell(CALL_STATUS_LABEL[l.status]),
        csvText(l.remarks || ''),
        csvText(l.updatedBy || ''),
        csvCell(l.updatedAt ? new Date(l.updatedAt).toLocaleString() : ''),
      ]),
    );
  };

  // ------------------------------------------------------------------------------------------------ render
  return (
    <div className="wa-bc-page wa-cs-page">
      <div className="wa-bc-toolbar wa-cs-toolbar">
        <p className="wa-bc-lede">
          Everyone who tapped a button on your templates, ready to call. After each call, set the status and add remarks
          so the whole team can see where every lead stands.
        </p>
        {showTeamActivity && (
          <div className="wa-an-range" role="tablist" aria-label="Call sheets view">
            <button type="button" role="tab" aria-selected={view === 'sheets'} className={view === 'sheets' ? 'is-active' : ''} onClick={() => setView('sheets')}>
              Call sheets
            </button>
            <button type="button" role="tab" aria-selected={view === 'team'} className={view === 'team' ? 'is-active' : ''} onClick={() => setView('team')}>
              Team activity
            </button>
          </div>
        )}
      </div>

      {error && <div className="wa-rr-notice is-error" role="alert">{error}</div>}

      {/* ============================================================ CALL SHEETS */}
      {view === 'sheets' && (
        <>
          {rules === null && !error && <p className="wa-rr-empty">Loading…</p>}

          {rules !== null && rules.length === 0 && (
            <section className="wa-bc-card wa-cs-empty">
              <h3>No reply rules yet</h3>
              <p>
                {onNavigate
                  ? 'Call sheets are built from reply rules. Create a rule for a template button on the Automations page, and everyone who taps it will appear here.'
                  : 'Call sheets are built from reply rules, which an admin or marketing manager sets up on the Automations page. Once a rule exists, everyone who taps its button appears here.'}
              </p>
              {onNavigate && (
                <button type="button" className="wa-bc-primary" onClick={() => onNavigate('automations')}>
                  Go to Automations
                </button>
              )}
            </section>
          )}

          {rules !== null && rules.length > 0 && (
            <>
              <div className="wa-cs-rules" role="tablist" aria-label="Rules">
                {rules.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    role="tab"
                    aria-selected={r.id === ruleId}
                    className={`wa-cs-rule${r.id === ruleId ? ' is-active' : ''}${r.active ? '' : ' is-paused'}`}
                    onClick={() => setRuleId(r.id)}
                  >
                    <span className="wa-cs-rule-name">{r.name}</span>
                    <span className="wa-cs-rule-meta">
                      {r.leadCount === 0 ? 'No one yet' : `${r.callStatusCounts.CALL_PENDING} to call · ${r.leadCount} total`}
                    </span>
                  </button>
                ))}
              </div>

              {rule && (
                <p className="wa-cs-rule-desc">
                  Customers who tapped <strong>“{rule.buttonText}”</strong> on{' '}
                  {rule.templateName ? <>the template <strong>{rule.templateName}</strong></> : <strong>any template</strong>}.
                  {!rule.active && ' This rule is paused, so no new people are being added.'}
                </p>
              )}

              {leads === null && !error && <p className="wa-rr-empty">Loading this call sheet…</p>}

              {leads !== null && total === 0 && (
                <section className="wa-bc-card wa-cs-empty">
                  <h3>No one has tapped this button yet</h3>
                  <p>People appear here automatically as soon as they tap it. You do not need to add anyone by hand.</p>
                </section>
              )}

              {leads !== null && total > 0 && (
                <>
                  <div className="wa-cs-stats" role="group" aria-label="Filter by call status">
                    <button type="button" className={`wa-cs-stat${statusFilter === 'ALL' ? ' is-active' : ''}`} aria-pressed={statusFilter === 'ALL'} onClick={() => { setStatusFilter('ALL'); setShown(PAGE); }}>
                      <strong>{total.toLocaleString()}</strong>
                      <span>All people</span>
                    </button>
                    {CALL_STATUS_ORDER.map(s => (
                      <button key={s} type="button" className={`wa-cs-stat tone-${CALL_STATUS_TONE[s]}${statusFilter === s ? ' is-active' : ''}`} aria-pressed={statusFilter === s} onClick={() => { setStatusFilter(s); setShown(PAGE); }}>
                        <strong>{counts[s].toLocaleString()}</strong>
                        <span>{CALL_STATUS_LABEL[s]}</span>
                      </button>
                    ))}
                  </div>

                  <div className="wa-cs-progress" aria-label={`${donePct} percent of calls done`}>
                    <div className="wa-cs-progress-bar"><div style={{ width: `${donePct}%` }} /></div>
                    <span>{counts.CALL_DONE.toLocaleString()} of {total.toLocaleString()} calls done ({donePct}%)</span>
                  </div>

                  <section className="wa-bc-card wa-cs-card">
                    <div className="wa-cs-tools">
                      <label className="wa-cs-search">
                        <Icon><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>
                        <span className="wa-hd-sr">Search this call sheet</span>
                        <input type="search" placeholder="Search name, number or remark" value={query} onChange={e => { setQuery(e.target.value); setShown(PAGE); }} />
                      </label>

                      <label className="wa-rr-range">
                        <span className="wa-hd-sr">Updated by</span>
                        <select value={byFilter} onChange={e => { setByFilter(e.target.value); setShown(PAGE); }}>
                          <option value="">Anyone’s updates</option>
                          <option value={NOBODY}>Not updated yet</option>
                          {updaters.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </label>

                      <button type="button" className="wa-bc-act" onClick={download} disabled={visible.length === 0}>
                        Download ({visible.length.toLocaleString()})
                      </button>
                    </div>

                    {visible.length === 0 ? (
                      <p className="wa-rr-empty">No one matches these filters.</p>
                    ) : (
                      <div className="wa-an-table-wrap">
                        <table className="wa-an-table wa-cs-table">
                          <thead>
                            <tr>
                              <th>Person</th>
                              <th>Tapped</th>
                              <th>Status</th>
                              <th>Remarks</th>
                              <th>Last update</th>
                              <th><span className="wa-hd-sr">Action</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {visible.slice(0, shown).map(l => (
                              <tr key={l.id}>
                                <td data-label="Person">
                                  <strong>{personName(l.contact)}</strong>
                                  <span className="wa-an-sub">+{l.contact.phone.replace(/^\+/, '')}</span>
                                </td>
                                <td data-label="Tapped">
                                  {dt(l.firstTapAt)}
                                  {l.tapCount > 1 && (
                                    <span className="wa-an-sub">
                                      {l.tapCount} times{tappedAgain(l) ? ' · tapped again' : ''}
                                    </span>
                                  )}
                                </td>
                                <td data-label="Status">
                                  <StatusPill status={l.status} />
                                  {tappedAgain(l) && <span className="wa-cs-again">Tapped again</span>}
                                </td>
                                <td data-label="Remarks" className="wa-cs-remarks">{l.remarks || <span className="wa-cs-none">No remarks</span>}</td>
                                <td data-label="Last update">
                                  {l.updatedBy ? (<>{l.updatedBy}<span className="wa-an-sub">{dt(l.updatedAt)}</span></>) : <span className="wa-cs-none">Not updated yet</span>}
                                </td>
                                <td data-label="Action">
                                  <button type="button" className="wa-bc-act is-primary" onClick={() => openUpdate(l)}>Update</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {visible.length > shown && (
                      <div className="wa-cs-more">
                        <button type="button" className="wa-bc-act" onClick={() => setShown(n => n + PAGE)}>
                          Show more ({(visible.length - shown).toLocaleString()} left)
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ============================================================ TEAM ACTIVITY */}
      {view === 'team' && (
        <>
          <div className="wa-cs-period">
            <div className="wa-an-range" role="group" aria-label="Period">
              {PERIODS.map(p => (
                <button key={p.days} type="button" className={days === p.days ? 'is-active' : ''} aria-pressed={days === p.days} onClick={() => setDays(p.days)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {overviewError && <div className="wa-rr-notice is-error" role="alert">{overviewError}</div>}
          {!overview && !overviewError && <p className="wa-rr-empty">Loading team activity…</p>}

          {overview && (
            <>
              <h3 className="wa-an-section-title">Where every lead stands now</h3>
              <p className="wa-an-section-sub">Across all rules.</p>
              <div className="wa-cs-stats" role="group" aria-label="All leads by status">
                {CALL_STATUS_ORDER.map(s => (
                  <div key={s} className={`wa-cs-stat is-static tone-${CALL_STATUS_TONE[s]}`}>
                    <strong>{overview.pipeline[s].toLocaleString()}</strong>
                    <span>{CALL_STATUS_LABEL[s]}</span>
                  </div>
                ))}
              </div>

              <h3 className="wa-an-section-title">Who did what</h3>
              <p className="wa-an-section-sub">Updates made by each team member in the {PERIODS.find(p => p.days === days)?.label.toLowerCase()}.</p>
              <section className="wa-bc-card wa-cs-card">
                {overview.people.length === 0 ? (
                  <p className="wa-rr-empty">No updates in this period.</p>
                ) : (
                  <div className="wa-an-table-wrap">
                    <table className="wa-an-table wa-cs-table">
                      <thead>
                        <tr>
                          <th>Team member</th>
                          <th>Updates</th>
                          <th>Leads worked</th>
                          <th>Call done</th>
                          <th>Not picked</th>
                          <th>Follow up</th>
                          <th>Last active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.people.map(p => (
                          <tr key={p.userId}>
                            <td data-label="Team member"><strong>{p.name}</strong><span className="wa-an-sub">{ROLE_LABEL[p.role] || p.role}</span></td>
                            <td data-label="Updates">{p.updates.toLocaleString()}</td>
                            <td data-label="Leads worked">{p.leadsTouched.toLocaleString()}</td>
                            <td data-label="Call done">{p.byStatus.CALL_DONE}</td>
                            <td data-label="Not picked">{p.byStatus.CALLED_NOT_PICKED}</td>
                            <td data-label="Follow up">{p.byStatus.FOLLOW_UP_PENDING}</td>
                            <td data-label="Last active">{dt(p.lastActiveAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <h3 className="wa-an-section-title">Latest updates</h3>
              <p className="wa-an-section-sub">The most recent status changes, with the remarks people wrote.</p>
              <section className="wa-bc-card wa-cs-card">
                {overview.recent.length === 0 ? (
                  <p className="wa-rr-empty">No updates in this period.</p>
                ) : (
                  <ul className="wa-cs-feed">
                    {overview.recent.map(r => (
                      <li key={r.id}>
                        <div className="wa-cs-feed-top">
                          <strong>{r.byName}</strong>
                          <span className="wa-cs-feed-when">{dt(r.at)}</span>
                        </div>
                        <div className="wa-cs-feed-line">
                          <StatusPill status={r.status} />
                          <span>{r.contactName && !r.contactName.startsWith('+') ? r.contactName : `+${r.phone}`}</span>
                          <span className="wa-cs-feed-rule">{r.ruleName}</span>
                        </div>
                        {r.remarks && <p className="wa-cs-feed-remark">{r.remarks}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}

      {/* ============================================================ UPDATE DIALOG */}
      {editing && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cs-title">
          <div className="modal-card" style={{ maxWidth: 560, width: '92%' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" id="cs-title">{personName(editing.contact)}</h3>
                <p className="modal-subtitle">
                  +{editing.contact.phone.replace(/^\+/, '')} · tapped “{editing.buttonText}”
                  {editing.tapCount > 1 ? ` ${editing.tapCount} times` : ''}
                </p>
              </div>
              <button type="button" className="close-btn" onClick={closeUpdate} aria-label="Close">✕</button>
            </div>

            <form onSubmit={save}>
              <fieldset className="wa-cs-choices">
                <legend>Call status</legend>
                {CALL_STATUS_ORDER.map(s => (
                  <label key={s} className={`wa-cs-choice${formStatus === s ? ' is-selected' : ''}`}>
                    <input type="radio" name="call-status" value={s} checked={formStatus === s} onChange={() => setFormStatus(s)} />
                    <span>
                      <strong>{CALL_STATUS_LABEL[s]}</strong>
                      <em>{CALL_STATUS_HINT[s]}</em>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="form-group">
                <label htmlFor="cs-remarks">Remarks</label>
                <textarea
                  id="cs-remarks"
                  className="form-input"
                  rows={3}
                  maxLength={REMARK_MAX}
                  placeholder="What happened on the call? For example: wants a demo on Friday, or phone switched off"
                  value={formRemarks}
                  onChange={e => setFormRemarks(e.target.value)}
                />
                <span className="wa-rr-field-hint">
                  {editing.remarks ? `Current remark: “${editing.remarks}”. ` : ''}
                  {formRemarks.length}/{REMARK_MAX}
                </span>
              </div>

              {formError && <div className="wa-rr-notice is-error" role="alert">{formError}</div>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeUpdate} disabled={saving}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save update'}</button>
              </div>
            </form>

            <div className="wa-cs-history">
              <h4>History</h4>
              {history === null && <p className="wa-rr-empty">Loading…</p>}
              {history !== null && history.length === 0 && <p className="wa-rr-empty">No updates yet. This person has not been called.</p>}
              {history !== null && history.length > 0 && (
                <ol>
                  {history.map(h => (
                    <li key={h.id}>
                      <div className="wa-cs-feed-line">
                        <StatusPill status={h.status} />
                        <span className="wa-cs-feed-when">{dt(h.createdAt)}</span>
                      </div>
                      <div className="wa-cs-history-by">{h.byName} <span>({ROLE_LABEL[h.byRole] || h.byRole})</span></div>
                      {h.remarks && <p className="wa-cs-feed-remark">{h.remarks}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
