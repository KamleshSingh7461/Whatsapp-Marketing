import { Contact } from '../types';
import { CURRENCIES } from './currency';

export const ALL_OPTED_IN = 'All Opted-In';
export const INTERNAL_TEST_GROUP = 'Internal Team Test Group';

// The "Internal Team Test Group" audience option is the contacts tagged "Internal Team".
const INTERNAL_TEAM_TAG = 'Internal Team';

/**
 * The single definition of who a broadcast reaches. The launch modal uses it to show the
 * recipient count and the dispatcher uses it to decide who is actually messaged, so the two
 * can never disagree.
 *
 * Only opted-in contacts are ever included. An audience that matches nobody returns an empty
 * list; callers must treat that as "send to no one", never as "send to everyone".
 */
export function resolveCampaignRecipients(contacts: Contact[], targetTags: string[]): Contact[] {
  const optedIn = contacts.filter(c => c.optedIn);
  if (targetTags.length === 0 || targetTags.includes(ALL_OPTED_IN)) return optedIn;

  const wanted = new Set(targetTags.map(t => (t === INTERNAL_TEST_GROUP ? INTERNAL_TEAM_TAG : t)));
  return optedIn.filter(c => (c.tags || []).some(t => wanted.has(t)));
}

// Meta's per-message rates for India in INR (same rates the dashboard ledger uses).
const META_RATE_INR: Record<string, number> = {
  MARKETING: 0.8629,
  UTILITY: 0.115,
  AUTHENTICATION: 0.115,
};

/**
 * Estimated Meta cost of a broadcast, in the app's internal currency unit (USD), which is what
 * `formatCurrency` expects. Converting through the INR rate means the INR display shows the real
 * per-message rate instead of a number inflated by the USD to INR multiplier.
 */
export function estimateCampaignCostUSD(recipients: number, category?: string): number {
  const inr = META_RATE_INR[category || 'MARKETING'] ?? META_RATE_INR.MARKETING;
  return (recipients * inr) / CURRENCIES.INR.rate;
}

/** Per-message cost in the same USD unit, for showing the rate itself. */
export function costPerMessageUSD(category?: string): number {
  return estimateCampaignCostUSD(1, category);
}
