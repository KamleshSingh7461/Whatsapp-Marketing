import React, { useEffect, useState } from 'react';
import { Campaign, Contact, Conversation, MetaInsights, RevenueAnalytics } from '../types';
import { CurrencyCode, formatFromINR } from '../lib/currency';
import { getMetaInsightsApi } from '../lib/api';

interface AnalyticsViewProps {
  analytics: RevenueAnalytics;
  currency: CurrencyCode;
  conversations?: Conversation[];
  campaigns?: Campaign[];
  contacts?: Contact[];
  onCurrencyChange?: (currency: CurrencyCode) => void;
}

const META_PRICING_URL = 'https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing';

const RANGES = [
  { days: 0, label: 'Today so far' },
  { days: 7, label: 'Last 7 days' },
  { days: 28, label: 'Last 28 days' },
  { days: 90, label: 'Last 90 days' },
] as const;

/** Message types in the order WhatsApp Manager lists them, with a plain-words description. */
const CATEGORY_DEFS = [
  { key: 'MARKETING', label: 'Marketing', note: 'Promotions and offers you send to start a conversation' },
  { key: 'UTILITY', label: 'Utility', note: 'Updates such as order status or account alerts' },
  { key: 'AUTHENTICATION', label: 'Authentication', note: 'One-time login codes (OTP)' },
  { key: 'AUTHENTICATION_INTERNATIONAL', label: 'Authentication – international', note: 'Login codes sent to numbers in other countries' },
  { key: 'SERVICE', label: 'Service', note: 'Your replies within 24 hours of a customer writing to you' },
] as const;

interface TypeRow {
  key: string;
  label: string;
  note: string;
  delivered: number;
  free: number;
  paid: number;
  cost: number;
}

interface Figures {
  source: 'meta' | 'estimate';
  sent: number;
  delivered: number;
  received: number;
  rows: TypeRow[];
  freeService: number;
  /** null when this app cannot tell (estimate mode). */
  freeEntry: number | null;
  paid: number;
  totalCost: number;
}

const Icon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

/** "x out of every 100", never above 100 and never negative. */
const per100 = (part: number, whole: number) =>
  whole > 0 ? Math.max(0, Math.min(100, Math.round((part / whole) * 100))) : 0;

const n = (value: number) => value.toLocaleString();

/** "2026-09-18" -> "18 Sep 2026". The server already worked the day out in the business timezone. */
const day = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// Same rule the Contacts page uses for its "YES leads" filter.
const isYesLead = (c: Contact) =>
  (c.tags || []).some(t => {
    const l = t.toLowerCase();
    return l.includes('yes') || l.includes('hot lead');
  });

const WORDS: Array<{ term: string; meaning: string }> = [
  { term: 'Sent / delivered', meaning: 'Sent means the message left your account. Delivered means it arrived on the customer’s phone (the two grey ticks in WhatsApp).' },
  { term: 'Broadcast', meaning: 'One message you send to many customers at the same time.' },
  { term: 'Template', meaning: 'A ready-made message that Meta (the company behind WhatsApp) has approved. WhatsApp only lets a business message a customer first with a template.' },
  { term: 'Marketing, Utility, Authentication, Service', meaning: 'The kinds of message Meta prices differently. Marketing is promotions. Utility is updates such as order status. Authentication is login codes. Service is your reply when a customer writes to you first.' },
  { term: 'Free customer service', meaning: 'Replies you send within 24 hours of a customer writing to you. Meta does not charge for these today.' },
  { term: 'Free entry point', meaning: 'When a customer starts a chat by tapping a Click-to-WhatsApp ad, Meta keeps messages free for 72 hours.' },
  { term: 'Agreed to receive messages', meaning: 'The customer gave permission to be messaged on WhatsApp (also called “opted in”). Broadcasts only go to these people.' },
  { term: '24-hour window', meaning: 'When a customer writes to you, you can reply freely for the next 24 hours. After that you need a template to start again.' },
  { term: 'Approximate', meaning: 'Meta says these figures can differ slightly from your invoice because of how data is processed. Your invoice is always the final word.' },
];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  analytics,
  currency,
  conversations = [],
  campaigns = [],
  contacts = [],
}) => {
  const { funnel, marketingCost, utilityCost, serviceCost } = analytics;

  // Meta's own numbers, the same ones WhatsApp Manager > Insights shows.
  const [days, setDays] = useState<number>(28);
  const [meta, setMeta] = useState<MetaInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const load = async () => {
      try {
        const res = await getMetaInsightsApi(days);
        if (alive) setMeta(res.available ? res : null);
      } catch {
        if (alive) setMeta(null);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [days]);

  const money = (amountInINR: number) => formatFromINR(amountInINR, currency, 2);

  // ---- The figures: from Meta when we have them, otherwise estimated from this app's own records ----
  let figures: Figures;
  if (meta) {
    const rows: TypeRow[] = CATEGORY_DEFS.map(def => {
      const b = meta.pricing[def.key] || {};
      const free = (b.FREE_CUSTOMER_SERVICE?.volume || 0) + (b.FREE_ENTRY_POINT?.volume || 0);
      const paid = b.REGULAR?.volume || 0;
      const cost = Object.values(b).reduce((acc, x) => acc + (x.cost || 0), 0);
      return { key: def.key, label: def.label, note: def.note, delivered: free + paid, free, paid, cost };
    });
    const known = new Set<string>(CATEGORY_DEFS.map(d => d.key));
    const other = Object.entries(meta.pricing).filter(([k]) => !known.has(k));
    if (other.length > 0) {
      let free = 0;
      let paid = 0;
      let cost = 0;
      for (const [, b] of other) {
        free += (b.FREE_CUSTOMER_SERVICE?.volume || 0) + (b.FREE_ENTRY_POINT?.volume || 0);
        paid += b.REGULAR?.volume || 0;
        cost += Object.values(b).reduce((acc, x) => acc + (x.cost || 0), 0);
      }
      if (free + paid > 0 || cost > 0) {
        rows.push({ key: 'OTHER', label: 'Other', note: 'Other message types Meta reports', delivered: free + paid, free, paid, cost });
      }
    }
    const sumType = (type: string) =>
      Object.values(meta.pricing).reduce((acc, b) => acc + (b[type]?.volume || 0), 0);
    figures = {
      source: 'meta',
      sent: meta.sent,
      delivered: meta.delivered,
      received: meta.received,
      rows,
      freeService: sumType('FREE_CUSTOMER_SERVICE'),
      freeEntry: sumType('FREE_ENTRY_POINT'),
      paid: rows.reduce((acc, r) => acc + r.paid, 0),
      totalCost: Math.round(rows.reduce((acc, r) => acc + r.cost, 0) * 100) / 100,
    };
  } else {
    const marketingFromCampaigns = campaigns.reduce((acc, c) => acc + (c.stats?.delivered || 0), 0);
    const marketingCount =
      marketingFromCampaigns > 0
        ? marketingFromCampaigns
        : Math.round(
            funnel.delivered > 0 && marketingCost > 0
              ? Math.min(funnel.delivered, Math.round(marketingCost / 0.8629))
              : 0,
          );
    // Utility cost is delivered utility messages x 0.115 (see Dashboard.tsx), so the count is worked back from it.
    const utilityCount = utilityCost > 0 ? Math.round(utilityCost / 0.115) : 0;
    const serviceCount = Math.max(0, funnel.delivered - marketingCount - utilityCount);
    const rows: TypeRow[] = [
      { key: 'MARKETING', label: 'Marketing', note: CATEGORY_DEFS[0].note, delivered: marketingCount, free: 0, paid: marketingCount, cost: marketingCost },
      { key: 'UTILITY', label: 'Utility', note: CATEGORY_DEFS[1].note, delivered: utilityCount, free: 0, paid: utilityCount, cost: utilityCost },
      { key: 'SERVICE', label: 'Service', note: CATEGORY_DEFS[4].note, delivered: serviceCount, free: serviceCount, paid: 0, cost: serviceCost },
    ];
    figures = {
      source: 'estimate',
      sent: funnel.sent,
      delivered: funnel.delivered,
      received: funnel.engaged,
      rows,
      freeService: serviceCount,
      freeEntry: null,
      paid: marketingCount + utilityCount,
      totalCost: marketingCost + utilityCost + serviceCost,
    };
  }

  const freeTotal = figures.freeService + (figures.freeEntry || 0);
  const totals = figures.rows.reduce(
    (acc, r) => ({ delivered: acc.delivered + r.delivered, free: acc.free + r.free, paid: acc.paid + r.paid, cost: acc.cost + r.cost }),
    { delivered: 0, free: 0, paid: 0, cost: 0 },
  );
  const reachedPer100 = per100(figures.delivered, figures.sent);
  const waiting = loading && !meta; // first load: don't flash estimates that Meta's numbers will replace
  const period = !meta
    ? 'all time'
    : meta.days === 0
      ? `today so far (${day(meta.startDay)})`
      : `the last ${meta.days} days (${day(meta.startDay)} to ${day(meta.endDay)})`;
  const sentence = meta ? `In ${period} you sent` : 'So far you have sent';

  // ---- Chats and contacts: always from this app's own records ----
  const totalChats = conversations.length;
  const finishedChats = conversations.filter(c => c.status === 'RESOLVED').length;
  const openChats = conversations.filter(c => c.status === 'OPEN' || !c.status).length;
  const freeReplyChats = conversations.filter(
    c => c.windowExpiresAt && new Date(c.windowExpiresAt).getTime() > Date.now(),
  ).length;

  const totalContacts = contacts.length;
  const agreedContacts = contacts.filter(c => c.optedIn).length;
  const yesContacts = contacts.filter(isYesLead).length;

  return (
    <div className="wa-bc-page wa-an-page">
      <div className="wa-bc-toolbar wa-an-toolbar">
        <p className="wa-bc-lede">
          A simple summary of your WhatsApp messaging, using the same figures as WhatsApp Manager: how many messages
          went out, what they cost, and who replied.
        </p>
        <div className="wa-an-controls">
          {(meta || loading) && (
            <div className="wa-an-range" role="group" aria-label="Time period">
              {RANGES.map(r => (
                <button
                  key={r.days}
                  type="button"
                  className={days === r.days ? 'is-active' : ''}
                  aria-pressed={days === r.days}
                  onClick={() => setDays(r.days)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          {!waiting && (
            <span className={`wa-bc-status ${figures.source === 'meta' ? 'tone-done' : 'tone-live'}`}>
              <span className="wa-bc-status-dot" />
              {figures.source === 'meta' ? 'Numbers from Meta' : 'Estimates from this app'}
            </span>
          )}
        </div>
      </div>

      {figures.source === 'estimate' && !waiting && (
        <div className="wa-an-notice is-warn" role="status">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>Could not reach Meta’s reports</strong>
            <span>
              These are estimates worked out from this app’s own records, covering all time. They may not match WhatsApp
              Manager exactly. The page tries again by itself every few minutes.
            </span>
          </div>
        </div>
      )}

      {/* 1. All messages */}
      <h3 className="wa-an-section-title">All messages</h3>
      {waiting ? (
        <div className="wa-an-loading" role="status">Loading your numbers from Meta…</div>
      ) : (
        <>
          <p className="wa-an-section-sub">
            {figures.sent > 0
              ? `${sentence} ${n(figures.sent)} messages, and ${n(figures.delivered)} arrived on customers’ phones.`
              : `${meta ? `No messages were sent in ${period}.` : 'No messages have been sent yet.'} Numbers fill in by themselves once you send a broadcast or reply to a chat.`}
          </p>
          <div className="wa-bc-kpis wa-an-kpis-3">
            <div className="wa-bc-kpi">
              <div className="wa-bc-kpi-icon tone-green">
                <Icon>
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </Icon>
              </div>
              <div className="wa-bc-kpi-body">
                <span className="wa-bc-kpi-label">Messages sent</span>
                <strong className="wa-bc-kpi-value">{n(figures.sent)}</strong>
                <span className="wa-bc-kpi-foot">Left your account for customers</span>
              </div>
            </div>

            <div className="wa-bc-kpi">
              <div className="wa-bc-kpi-icon tone-teal">
                <Icon>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </Icon>
              </div>
              <div className="wa-bc-kpi-body">
                <span className="wa-bc-kpi-label">Messages delivered</span>
                <strong className="wa-bc-kpi-value">{n(figures.delivered)}</strong>
                <span className="wa-bc-kpi-foot">{reachedPer100} out of every 100 sent arrived</span>
              </div>
            </div>

            <div className="wa-bc-kpi">
              <div className="wa-bc-kpi-icon tone-slate">
                <Icon>
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </Icon>
              </div>
              <div className="wa-bc-kpi-body">
                <span className="wa-bc-kpi-label">Messages received</span>
                <strong className="wa-bc-kpi-value">{n(figures.received)}</strong>
                <span className="wa-bc-kpi-foot">From this app’s chat records</span>
              </div>
            </div>
          </div>

          <p className="wa-an-note">
            {meta && meta.days === 0
              ? 'Today’s figures are still growing as Meta adds to them. '
              : 'Days run up to yesterday, the same as WhatsApp Manager. Choose “Today so far” to include today, which Meta is still adding to. '}
            Messages received are counted from this app’s own chat records, because Meta’s reports do not include
            them, so that one number can differ from WhatsApp Manager (for example on a test server that does not
            receive customer messages).
          </p>

          {/* 2. Free, paid and charges */}
          <h3 className="wa-an-section-title">Free and paid messages</h3>
          <p className="wa-an-section-sub">
            Meta charges for some delivered messages and not for others. Here is the split
            {figures.source === 'meta' ? ` for ${period}` : ''}.
          </p>
          <div className="wa-bc-kpis wa-an-kpis-3">
            <div className="wa-bc-kpi">
              <div className="wa-bc-kpi-icon tone-green">
                <Icon>
                  <polyline points="20 12 20 22 4 22 4 12" />
                  <rect x="2" y="7" width="20" height="5" />
                  <line x1="12" y1="22" x2="12" y2="7" />
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                </Icon>
              </div>
              <div className="wa-bc-kpi-body">
                <span className="wa-bc-kpi-label">Free messages delivered</span>
                <strong className="wa-bc-kpi-value">{n(freeTotal)}</strong>
                <ul className="wa-an-lines">
                  <li><span>Free customer service</span><strong>{n(figures.freeService)}</strong></li>
                  <li><span>Free entry point</span><strong>{figures.freeEntry === null ? 'Not tracked' : n(figures.freeEntry)}</strong></li>
                </ul>
              </div>
            </div>

            <div className="wa-bc-kpi">
              <div className="wa-bc-kpi-icon tone-amber">
                <Icon>
                  <rect x="1" y="4" width="22" height="16" rx="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </Icon>
              </div>
              <div className="wa-bc-kpi-body">
                <span className="wa-bc-kpi-label">Paid messages delivered</span>
                <strong className="wa-bc-kpi-value">{n(figures.paid)}</strong>
                <span className="wa-bc-kpi-foot">Messages Meta charges for</span>
              </div>
            </div>

            <div className="wa-bc-kpi">
              <div className="wa-bc-kpi-icon tone-slate">
                <Icon>
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="2.5" />
                  <path d="M6 12h.01M18 12h.01" />
                </Icon>
              </div>
              <div className="wa-bc-kpi-body">
                <span className="wa-bc-kpi-label">Approximate total charges</span>
                <strong className="wa-bc-kpi-value">{money(figures.totalCost)}</strong>
                <span className="wa-bc-kpi-foot">
                  {figures.totalCost === 0 ? 'Nothing to pay for this period' : 'Your invoice can differ slightly'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. By type */}
          <h3 className="wa-an-section-title">Delivered messages by type</h3>
          <p className="wa-an-section-sub">
            Meta prices each kind of message differently. This shows how many of each were delivered and what they cost.
          </p>
          <section className="wa-bc-card wa-an-card">
            <div className="wa-an-table-wrap">
              <table className="wa-an-table">
                <thead>
                  <tr>
                    <th>Type of message</th>
                    <th>Delivered</th>
                    <th>Free</th>
                    <th>Paid</th>
                    <th>Approximate cost</th>
                  </tr>
                </thead>
                <tbody>
                  {figures.rows.map(row => (
                    <tr key={row.key}>
                      <td data-label="Type of message">
                        <strong>{row.label}</strong>
                        <span className="wa-an-sub">{row.note}</span>
                      </td>
                      <td data-label="Delivered">{n(row.delivered)}</td>
                      <td data-label="Free">{n(row.free)}</td>
                      <td data-label="Paid">{n(row.paid)}</td>
                      <td data-label="Approximate cost"><strong>{money(row.cost)}</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td data-label="Type of message"><strong>All types</strong></td>
                    <td data-label="Delivered"><strong>{n(totals.delivered)}</strong></td>
                    <td data-label="Free"><strong>{n(totals.free)}</strong></td>
                    <td data-label="Paid"><strong>{n(totals.paid)}</strong></td>
                    <td data-label="Approximate cost"><strong>{money(totals.cost)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {figures.source === 'meta' ? (
              <p className="wa-an-foot-note">
                These come straight from Meta’s reports, the same ones behind WhatsApp Manager, then Insights. Meta says
                they are approximate and can differ slightly from your invoice. Amounts are in rupees as billed by Meta.
              </p>
            ) : (
              <div className="wa-an-heads-up" role="note">
                <strong>Heads-up: pricing is changing.</strong> From 1 October 2026 Meta starts charging per message for
                replies sent inside the 24-hour window. These estimates do not include those charges, so your Meta
                invoice can be higher after that date. See{' '}
                <a href={META_PRICING_URL} target="_blank" rel="noreferrer">Meta’s official price list</a> for current
                rates.
              </div>
            )}
          </section>
        </>
      )}

      {/* 4. Chats */}
      <h3 className="wa-an-section-title">Your chats</h3>
      <p className="wa-an-section-sub">Conversations with customers in the Chats tab right now.</p>
      <div className="wa-bc-kpis">
        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-green">
            <Icon>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </Icon>
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">All chats</span>
            <strong className="wa-bc-kpi-value">{n(totalChats)}</strong>
            <span className="wa-bc-kpi-foot">People you are in touch with</span>
          </div>
        </div>

        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-amber">
            <Icon>
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </Icon>
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">Still open</span>
            <strong className="wa-bc-kpi-value">{n(openChats)}</strong>
            <span className="wa-bc-kpi-foot">Not marked as finished yet</span>
          </div>
        </div>

        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-teal">
            <Icon>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </Icon>
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">Finished</span>
            <strong className="wa-bc-kpi-value">{n(finishedChats)}</strong>
            <span className="wa-bc-kpi-foot">{per100(finishedChats, totalChats)} out of every 100 chats</span>
          </div>
        </div>

        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-slate">
            <Icon>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </Icon>
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">You can reply freely to</span>
            <strong className="wa-bc-kpi-value">{n(freeReplyChats)}</strong>
            <span className="wa-bc-kpi-foot">Wrote to you in the last 24 hours</span>
          </div>
        </div>
      </div>

      {/* 5. Contacts */}
      <h3 className="wa-an-section-title">Your contacts</h3>
      <p className="wa-an-section-sub">The people saved in Contacts &amp; CRM.</p>
      <div className="wa-bc-kpis wa-an-kpis-3">
        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-green">
            <Icon>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </Icon>
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">People in your contacts</span>
            <strong className="wa-bc-kpi-value">{n(totalContacts)}</strong>
            <span className="wa-bc-kpi-foot">Everyone saved so far</span>
          </div>
        </div>

        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-teal">
            <Icon>
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <polyline points="17 11 19 13 23 9" />
            </Icon>
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">Agreed to receive messages</span>
            <strong className="wa-bc-kpi-value">{n(agreedContacts)}</strong>
            <span className="wa-bc-kpi-foot">Only these people get broadcasts</span>
          </div>
        </div>

        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-amber">
            <Icon>
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </Icon>
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">Replied “Yes”</span>
            <strong className="wa-bc-kpi-value">{n(yesContacts)}</strong>
            <span className="wa-bc-kpi-foot">Interested. Call these people first</span>
          </div>
        </div>
      </div>

      {/* 6. Words used on this page */}
      <details className="wa-bc-card wa-an-card wa-an-words">
        <summary>
          <span>Words used on this page</span>
          <span className="wa-an-words-hint">Tap to open</span>
        </summary>
        <dl className="wa-an-words-list">
          {WORDS.map(w => (
            <div key={w.term}>
              <dt>{w.term}</dt>
              <dd>{w.meaning}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
};
