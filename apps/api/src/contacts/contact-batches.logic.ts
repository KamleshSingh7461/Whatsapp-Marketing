// Contact batches: every contact is placed in a numbered batch of 500 so a broadcast can go to one batch at a time
// (Meta's daily sending limit). No database here, so it can be checked with:
//   npx tsx src/contacts/contact-batches.logic.check.ts
//
// Rules:
//  - Batch N holds contacts number (N-1)*500+1 to N*500, oldest contact first. Its tag is
//    "Batch N: Contacts <first> - <last>", so Batch 1 and Batch 2 keep the names they already had.
//  - A contact's batch never changes once given: a broadcast already sent to a batch must never reach the same people
//    again through a later batch.
//  - New contacts go into the newest batch while it has room and has not been broadcast to; otherwise a new batch is
//    started. Earlier batches are never topped up, so a batch that was sent stays exactly as it was sent.
//  - Batching only ever ADDS a tag; it never removes or changes one. People holding an old wide batch tag
//    ("Batch 3: Contacts 1001 - 2000", "Batch 4: Contacts 2001 - 3000") that no broadcast used keep that tag and also get
//    a 500-size batch. If a broadcast did use their old tag, they are left exactly as they are.

export const BATCH_SIZE = 500;

const BATCH_TAG = /^Batch (\d+): Contacts (\d+) - (\d+)$/;

export function batchTag(n: number): string {
  return `Batch ${n}: Contacts ${(n - 1) * BATCH_SIZE + 1} - ${n * BATCH_SIZE}`;
}

/** The batch number of a current (500-size) batch tag, or null for anything else. */
export function batchNumberOf(tag: string): number | null {
  const m = BATCH_TAG.exec(tag || '');
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && tag === batchTag(n) ? n : null;
}

/** Any batch tag, current or from the old wide scheme. */
export function isBatchLikeTag(tag: string): boolean {
  return BATCH_TAG.test(tag || '');
}

const MAX_TAG_LENGTH = 60;

/** A hand-typed tag, tidied: trimmed, single spaces, at most 60 characters. Empty when nothing is left. */
export function cleanTag(tag: unknown): string {
  return String(tag ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
}

/**
 * A manual tag edit from the Contacts page, applied to the tags the contact has NOW: only the tags the person added
 * or removed change, so a tag added meanwhile (by a reply rule, an import or batching) is never lost. Batch tags are
 * given out by the server and can be neither added nor removed by hand.
 */
export function applyTagEdit(current: string[], add: unknown[] = [], remove: unknown[] = []): string[] {
  const toRemove = new Set(remove.map(cleanTag).filter(t => t && !isBatchLikeTag(t)));
  const kept = (current || []).filter(t => !toRemove.has(t));
  const toAdd = add.map(cleanTag).filter(t => t && !isBatchLikeTag(t) && !kept.includes(t));
  return [...kept, ...Array.from(new Set(toAdd))];
}

export interface BatchContact {
  id: string;
  tags: string[];
}

export interface BatchPlan {
  /** batch number -> ids of contacts to add to it (the only change batching ever makes) */
  add: Map<number, string[]>;
}

/** True when this contact still needs a batch: no current batch, and not in an old batch that was broadcast to. */
export function needsBatch(tags: string[], sentTags: Set<string>): boolean {
  if ((tags || []).some(t => batchNumberOf(t) !== null)) return false;
  return !(tags || []).some(t => isBatchLikeTag(t) && sentTags.has(t));
}

/**
 * Works out which contacts still need a batch and which batch each one gets.
 *
 * @param contacts every contact, oldest first
 * @param sentTags batch tags a broadcast has already gone to (those batches never take new members)
 * @param recovered contacts known to have been in a batch's broadcast (from the server's send records) but whose batch
 *   tag is missing; they are put back in that batch rather than into a new one
 */
export function planBatches(
  contacts: BatchContact[],
  sentTags: Set<string>,
  recovered: Map<string, number> = new Map(),
): BatchPlan {
  const counts = new Map<number, number>();
  const bump = (n: number) => counts.set(n, (counts.get(n) || 0) + 1);
  const add = new Map<number, string[]>();
  const addTo = (n: number, id: string) => {
    if (!add.has(n)) add.set(n, []);
    add.get(n)!.push(id);
    bump(n);
  };
  const unassigned: string[] = [];

  for (const c of contacts) {
    const tags = c.tags || [];
    const current = tags.map(batchNumberOf).filter((n): n is number => n !== null);
    if (current.length > 0) current.forEach(bump);
    else if (!needsBatch(tags, sentTags)) continue; // in an old batch that was broadcast to: leave as sent
    else if (recovered.has(c.id)) addTo(recovered.get(c.id)!, c.id);
    else unassigned.push(c.id);
  }

  const sentNumbers = new Set([...sentTags].map(batchNumberOf).filter((n): n is number => n !== null));
  const newest = Math.max(0, ...counts.keys());
  let open = newest > 0 && (counts.get(newest) || 0) < BATCH_SIZE && !sentNumbers.has(newest) ? newest : newest + 1;
  for (const id of unassigned) {
    while ((counts.get(open) || 0) >= BATCH_SIZE || sentNumbers.has(open)) open++;
    addTo(open, id);
  }
  return { add };
}
