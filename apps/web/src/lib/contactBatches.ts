// Contact batches as the broadcast screen shows them. The server gives every contact a batch of 500 (see
// apps/api/src/contacts/contact-batches.logic.ts); this reads those tags back. Checked by scripts/contactBatches.check.ts.
import type { Campaign, Contact } from '../types';
import { resolveCampaignAudience } from './campaignAudience';

export const BATCH_SIZE = 500;

const BATCH_TAG = /^Batch (\d+): Contacts (\d+) - (\d+)$/;

/** Any batch tag, current (500 each) or from the old wide scheme. */
export const isBatchLikeTag = (tag: string) => BATCH_TAG.test(tag || '');

/** The batch number of a current batch tag, or null. */
export function batchNumberOf(tag: string): number | null {
  const m = BATCH_TAG.exec(tag || '');
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && Number(m[2]) === (n - 1) * BATCH_SIZE + 1 && Number(m[3]) === n * BATCH_SIZE ? n : null;
}

export interface BatchOption {
  tag: string;
  /** null for an old wide batch */
  number: number | null;
  label: string;
  /** everyone in the batch */
  members: number;
  /** opted in and not resting: who a broadcast to this batch would reach */
  reachable: number;
  /** broadcasts of the chosen template that already went to this batch, newest first */
  sentWith: Array<{ name: string; templateName: string; at?: string | null }>;
}

const fmt = (n: number) => n.toLocaleString('en-IN');

/**
 * The batches, with which of them already received `templateName`. "Already sent" is always about one template: a new
 * marketing template has not been sent to anyone yet, so every batch is open for it again, starting from Batch 1.
 */
export function batchOptions(
  contacts: Contact[],
  campaigns: Campaign[],
  templateName: string | undefined,
  now: number = Date.now(),
): BatchOption[] {
  // Old wide batch tags are kept on contacts (nothing is ever removed) but only listed if a broadcast used them;
  // the people in an unused one are also in a current 500-size batch.
  const usedTags = new Set(campaigns.filter(c => c.status !== 'DRAFT').flatMap(c => c.targetTags || []));
  const tags = Array.from(new Set(contacts.flatMap(c => (c.tags || []).filter(isBatchLikeTag))))
    .filter(tag => batchNumberOf(tag) !== null || usedTags.has(tag));
  return tags
    .map(tag => {
      const number = batchNumberOf(tag);
      const m = BATCH_TAG.exec(tag)!;
      const sentWith = campaigns
        .filter(c => c.status !== 'DRAFT' && c.templateName === templateName && (c.targetTags || []).includes(tag))
        .map(c => ({ name: c.name, templateName: c.templateName, at: c.sentAt || c.startedAt || c.createdAt || null }))
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
      return {
        tag,
        number,
        label: number !== null
          ? `Batch ${number} · contacts ${fmt(Number(m[2]))}–${fmt(Number(m[3]))}`
          : `${tag} (older batch)`,
        members: contacts.filter(c => (c.tags || []).includes(tag)).length,
        reachable: resolveCampaignAudience(contacts, [tag], now).recipients.length,
        sentWith,
      };
    })
    .sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.tag.localeCompare(b.tag));
}

/** The first batch that has not had this template yet and has someone to reach: the natural next send. */
export function nextUnsentBatch(options: BatchOption[]): BatchOption | undefined {
  return options.find(o => o.number !== null && o.sentWith.length === 0 && o.reachable > 0);
}
