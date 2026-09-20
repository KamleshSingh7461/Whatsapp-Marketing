/**
 * Turns the two Meta Graph API reports behind WhatsApp Manager > Insights > "Message delivery insights"
 * into plain totals. Kept free of Nest/Prisma/network code so it can be tested with Meta's documented
 * response shape.
 *
 *  - `analytics`         -> messages sent / delivered
 *  - `pricing_analytics` -> delivered messages and cost, by category (Marketing, Service, ...) and by
 *                           pricing type (REGULAR = paid, FREE_CUSTOMER_SERVICE, FREE_ENTRY_POINT)
 */

export interface AnalyticsDataPoint {
  sent?: number;
  delivered?: number;
}

export interface PricingDataPoint {
  pricing_category?: string;
  pricing_type?: string;
  volume?: number;
  cost?: number;
}

export interface PricingBucket {
  volume: number;
  cost: number;
}

/** category -> pricing type -> totals, e.g. pricing.MARKETING.REGULAR = { volume: 495, cost: 431.02 } */
export type PricingBreakdown = Record<string, Record<string, PricingBucket>>;

export interface MetaInsightsResult {
  available: true;
  days: number;
  /** First and last calendar day covered, "YYYY-MM-DD" in the business timezone. */
  startDay: string;
  endDay: string;
  sent: number;
  delivered: number;
  /** Customer messages received, counted from this app's own webhook records. */
  received: number;
  pricing: PricingBreakdown;
}

export interface MetaInsightsUnavailable {
  available: false;
  days: number;
  reason: 'not_configured' | 'meta_error';
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function sumMessageAnalytics(points: AnalyticsDataPoint[] | undefined | null) {
  let sent = 0;
  let delivered = 0;
  for (const p of points ?? []) {
    sent += num(p?.sent);
    delivered += num(p?.delivered);
  }
  return { sent, delivered };
}

/**
 * `pricing_analytics.data` is a list of `{ data_points: [...] }` blocks. Flattens them and adds up
 * volume and cost per category and pricing type. Cost is rounded to 2 decimals at the end only.
 */
export function groupPricing(blocks: Array<{ data_points?: PricingDataPoint[] }> | undefined | null): PricingBreakdown {
  const out: PricingBreakdown = {};
  for (const block of blocks ?? []) {
    for (const p of block?.data_points ?? []) {
      const category = p?.pricing_category || 'UNKNOWN';
      const type = p?.pricing_type || 'REGULAR';
      const bucket = ((out[category] ??= {})[type] ??= { volume: 0, cost: 0 });
      bucket.volume += num(p?.volume);
      bucket.cost += num(p?.cost);
    }
  }
  for (const types of Object.values(out)) {
    for (const bucket of Object.values(types)) {
      bucket.cost = Math.round(bucket.cost * 100) / 100;
    }
  }
  return out;
}

/**
 * Whole days, 1 to 90 (the page offers 7, 28 and 90). 0 means "today so far". Anything missing or
 * invalid falls back to 28.
 */
export function clampDays(input: unknown): number {
  if (input === undefined || input === null || input === '') return 28;
  const d = Math.floor(Number(input));
  if (!Number.isFinite(d) || d < 0) return 28;
  return Math.min(d, 90);
}

/**
 * The time window to ask Meta for, matching WhatsApp Manager: whole calendar days in the business's
 * timezone, ending YESTERDAY. Manager leaves today out because Meta is still adding to it, and Meta
 * buckets its daily figures at local midnight (India time for this account, +330 minutes).
 * `days` = 0 gives today so far. Returns UNIX seconds.
 */
export function buildWindow(nowSec: number, days: number, offsetMinutes = 330) {
  const off = offsetMinutes * 60;
  const todayStart = Math.floor((nowSec + off) / 86400) * 86400 - off;
  if (days === 0) return { start: todayStart, end: nowSec };
  return { start: todayStart - days * 86400, end: todayStart - 1 };
}

/** "YYYY-MM-DD" for a UNIX time, as a calendar day in the business timezone. */
export function localDay(sec: number, offsetMinutes = 330): string {
  return new Date((sec + offsetMinutes * 60) * 1000).toISOString().slice(0, 10);
}
