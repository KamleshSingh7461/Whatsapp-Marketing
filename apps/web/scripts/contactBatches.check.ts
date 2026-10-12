// Run with:  cd apps/api && npx tsx ../web/scripts/contactBatches.check.ts
import assert from 'node:assert/strict';
import { batchNumberOf, batchOptions, isBatchLikeTag, nextUnsentBatch } from '../src/lib/contactBatches';
// The server gives out the batches: read its own names so the two can never drift apart.
import { batchNumberOf as serverNumber, batchTag, isBatchLikeTag as serverLike } from '../../api/src/contacts/contact-batches.logic';
import type { Campaign, Contact } from '../src/types';

// ---- tag reading matches the server
for (const tag of [batchTag(1), batchTag(2), batchTag(3), batchTag(40), 'Batch 3: Contacts 1001 - 2000', 'Batch 4: Contacts 2001 - 3000', 'VIP', '']) {
  assert.equal(batchNumberOf(tag), serverNumber(tag), tag);
  assert.equal(isBatchLikeTag(tag), serverLike(tag), tag);
}
console.log('ok  batch tags are read the same way as the server writes them');

// ---- options: sizes, reachable, already-sent markers, order, next batch
{
  const person = (i: number, tag: string, over: Partial<Contact> = {}): Contact =>
    ({ id: `c${i}`, phone: `9190000${String(i).padStart(5, '0')}`, displayName: `P${i}`, optedIn: true, tags: [tag], ...over });
  const contacts: Contact[] = [
    ...Array.from({ length: 500 }, (_, i) => person(i, batchTag(1))),
    ...Array.from({ length: 500 }, (_, i) => person(500 + i, batchTag(2))),
    ...Array.from({ length: 500 }, (_, i) => person(1000 + i, batchTag(3), i < 3 ? { optedIn: false } : {})),
    ...Array.from({ length: 120 }, (_, i) => person(1500 + i, batchTag(4))),
  ];
  const cmp = (name: string, tag: string, sentAt: string, status: Campaign['status'] = 'COMPLETED') =>
    ({ id: name, name, templateId: 't', templateName: 'tpl_' + name, category: 'MARKETING', status, sentAt, targetTags: [tag], totalRecipients: 500, stats: {} as any }) as Campaign;
  // cmp(name) uses template "tpl_<name>"; give two campaigns the same template to model one template sent batch by batch
  const campaigns = [
    { ...cmp('First 1', batchTag(1), '2026-10-01'), templateName: 'tpl_first' },
    { ...cmp('First 2', batchTag(2), '2026-10-02'), templateName: 'tpl_first' },
    { ...cmp('Draft 3', batchTag(3), '2026-10-03', 'DRAFT'), templateName: 'tpl_first' },
  ];

  const opts = batchOptions(contacts, campaigns, 'tpl_first');
  assert.deepEqual(opts.map(o => o.number), [1, 2, 3, 4]);
  assert.deepEqual(opts.map(o => o.members), [500, 500, 500, 120]);
  assert.equal(opts[2].reachable, 497, 'not opted in are not reachable');
  assert.equal(opts[0].sentWith[0].name, 'First 1');
  assert.equal(opts[2].sentWith.length, 0, 'a draft does not count as sent');
  assert.equal(opts[2].label, 'Batch 3 · contacts 1,001–1,500');
  assert.equal(nextUnsentBatch(opts)?.number, 3);
  console.log('ok  same template: Batch 1 and 2 marked sent, Batch 3 is next');

  // An old wide tag left on contacts is listed only if a broadcast used it
  const withOld = [...contacts, person(9001, 'Batch 3: Contacts 1001 - 2000')];
  assert.equal(batchOptions(withOld, campaigns, 'tpl_first').some(o => o.number === null), false, 'unused old tag hidden');
  const usedOld = [...campaigns, cmp('Old 3', 'Batch 3: Contacts 1001 - 2000', '2026-09-01')];
  assert.equal(batchOptions(withOld, usedOld, 'tpl_first').some(o => o.number === null), true, 'used old tag listed');
  console.log('ok  old wide tags are listed only when a broadcast used them');

  // A new marketing template has gone to nobody: every batch is open again, starting at Batch 1
  const fresh = batchOptions(contacts, campaigns, 'tpl_new_offer');
  assert.deepEqual(fresh.map(o => o.sentWith.length), [0, 0, 0, 0]);
  assert.equal(nextUnsentBatch(fresh)?.number, 1);
  console.log('ok  new template: no batch is marked sent, Batch 1 is next');
}
