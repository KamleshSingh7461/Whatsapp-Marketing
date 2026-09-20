// Run with:  cd apps/api && npx tsx ../web/scripts/metaDelivery.check.ts
import assert from 'node:assert/strict';
import { ALL_OPTED_IN, INTERNAL_TEST_GROUP, resolveCampaignAudience, resolveCampaignRecipients } from '../src/lib/campaignAudience';
import { formatBlockUntil, isMetaBlocked, metaBlockOf, metaBlockReason } from '../src/lib/metaDelivery';
// The server writes the data this file reads: use its real writer so the two can never drift apart.
import { nextMetaDelivery } from '../../api/src/delivery-blocks/delivery-blocks.logic';
import type { Contact } from '../src/types';

const NOW = Date.parse('2026-09-20T06:00:00.000Z');
const day = (n: number) => NOW + n * 86400000;

const person = (id: string, over: Partial<Contact> = {}): Contact =>
  ({ id, phone: '91' + id, displayName: id, optedIn: true, tags: ['New Lead'], ...over } as Contact);
const refused = (code: string, at = NOW) => ({ metaDelivery: nextMetaDelivery(undefined, code, 'w.' + code, new Date(at))! });

// ---- reading what the server wrote
{
  const c = person('a', { attributes: { lifetimeValue: 5, ...refused('131049') } });
  const b = metaBlockOf(c, NOW + 1000)!;
  assert.equal(b.code, '131049'); assert.equal(b.count, 1);
  assert.equal(b.until.getTime(), day(14));
  assert.match(metaBlockReason(b), /held back marketing/);
  assert.equal(isMetaBlocked(c, day(13)), true);
  assert.equal(isMetaBlocked(c, day(14)), false);
  assert.match(formatBlockUntil(b), /^\d{1,2} [A-Z][a-z]{2}$/);
  console.log('ok  the browser reads exactly what the server writes, with the same expiry moment');
}

// ---- malformed or missing data never blocks anyone
for (const attributes of [undefined, {}, { metaDelivery: null }, { metaDelivery: 'x' }, { metaDelivery: [] }, { metaDelivery: {} }, { metaDelivery: { until: 'soon' } }] as any[]) {
  assert.equal(isMetaBlocked(person('x', { attributes }), NOW), false, JSON.stringify(attributes));
}
console.log('ok  missing or malformed data never blocks anyone');

// ---- the audience
const ceo = person('8779377330', { tags: ['New Lead', 'Internal Team'], attributes: refused('131049') });
const director = person('9167529242', { attributes: refused('131049') });
const fine = person('9999900001');
const fineInternal = person('9999900002', { tags: ['Internal Team'] });
const optedOut = person('9999900003', { optedIn: false });
const badNumber = person('9999900004', { attributes: refused('131026') });
const expired = person('9999900005', { attributes: refused('131049', NOW - 20 * 86400000) }); // rest ended 6 days ago
const all = [ceo, director, fine, fineInternal, optedOut, badNumber, expired];
const ids = (l: Contact[]) => l.map(c => c.id).sort();

{
  const a = resolveCampaignAudience(all, [ALL_OPTED_IN], NOW);
  assert.deepEqual(ids(a.recipients), ['9999900001', '9999900002', '9999900005']);
  assert.deepEqual(ids(a.skipped), ['8779377330', '9167529242', '9999900004']);
  console.log('ok  all opted-in: refused people are skipped, opted-out people are never counted, an ended rest is eligible again');
}
{
  const a = resolveCampaignAudience(all, [INTERNAL_TEST_GROUP], NOW);
  assert.deepEqual(ids(a.recipients), ['9999900002']);
  assert.deepEqual(ids(a.skipped), ['8779377330']);
  const b = resolveCampaignAudience(all, ['New Lead'], NOW);
  assert.equal(b.recipients.length + b.skipped.length, all.filter(c => c.optedIn && c.tags.includes('New Lead')).length);
  const empty = resolveCampaignAudience(all, ['No Such Tag'], NOW);
  assert.deepEqual([empty.recipients.length, empty.skipped.length], [0, 0], 'a tag nobody has means send to no one');
  console.log('ok  tag and internal-team audiences respect the same rule; a tag nobody has reaches no one');
}
{
  // everyone in the audience resting: an empty list, which callers must treat as "send to no one"
  const onlyBlocked = resolveCampaignAudience([ceo, director], [ALL_OPTED_IN], NOW);
  assert.equal(onlyBlocked.recipients.length, 0); assert.equal(onlyBlocked.skipped.length, 2);
  console.log('ok  an audience made only of resting people sends to no one');
}
{
  // the preview count and the actual send come from the same function
  assert.deepEqual(ids(resolveCampaignRecipients(all, [ALL_OPTED_IN], NOW)), ids(resolveCampaignAudience(all, [ALL_OPTED_IN], NOW).recipients));
  // and time moves on: after 14 days the two are back in
  assert.equal(resolveCampaignRecipients(all, [ALL_OPTED_IN], day(15)).length, 5);
  console.log('ok  count and send agree; after the rest period the two are included again');
}

console.log('\nmetaDelivery: all checks passed');
