// Run with: npx tsx src/delivery-blocks/delivery-blocks.logic.check.ts
import assert from 'node:assert/strict';
import { REST_DAYS, activeMetaDelivery, isBlockingCode, isMetaBlocked, nextMetaDelivery, shouldClearOnDelivery } from './delivery-blocks.logic';

const NOW = new Date('2026-09-20T06:00:00.000Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86400000);
const at = (d: Date) => d.toISOString();

// ---- which refusals count: only ones about the person
for (const c of ['131049', 130472, '131050', 131026]) assert.equal(isBlockingCode(c), true, String(c));
for (const c of ['131042', '131047', '130429', '131009', '', undefined, null, 'abc']) assert.equal(isBlockingCode(c), false, String(c));
console.log('ok  only person-specific refusals count (payment, 24h window and rate limits do not)');

// ---- first refusal: rest period by kind
{
  const n = nextMetaDelivery(undefined, '131049', 'wamid.1', NOW)!;
  assert.equal(n.code, '131049'); assert.equal(n.count, 1); assert.equal(n.lastWamid, 'wamid.1');
  assert.equal(n.until, at(day(14))); assert.equal(n.at, at(NOW));
  assert.equal(nextMetaDelivery(undefined, '130472', 'w', NOW)!.until, at(day(14)));
  assert.equal(nextMetaDelivery(undefined, '131026', 'w', NOW)!.until, at(day(30)));
  assert.equal(nextMetaDelivery(undefined, '131050', 'w', NOW)!.until, at(day(180)));
  assert.equal(nextMetaDelivery(undefined, '131042', 'w', NOW), null);
  console.log('ok  rest periods: 131049/130472 14 days, 131026 30 days, 131050 180 days; other codes ignored');
}

// ---- the same webhook delivered twice changes nothing; a new refusal extends the rest and counts up
{
  const first = nextMetaDelivery(undefined, '131049', 'wamid.A', NOW)!;
  assert.equal(nextMetaDelivery(first, '131049', 'wamid.A', day(1)), null, 'duplicate delivery of the same notice');
  const second = nextMetaDelivery(first, '131049', 'wamid.B', day(3))!;
  assert.equal(second.count, 2);
  assert.equal(second.until, at(day(3 + 14)), 'rest restarts from the newest refusal');
  console.log('ok  a repeated notice is ignored; a new refusal restarts the rest and counts up');
}

// ---- a longer rest already in force is never shortened
{
  const optOut = nextMetaDelivery(undefined, '131050', 'wamid.X', NOW)!; // 180 days
  const later = nextMetaDelivery(optOut, '131049', 'wamid.Y', day(2))!; // would only be 14 days
  assert.equal(later.until, optOut.until);
  assert.equal(later.code, '131050', 'the more serious reason stays');
  assert.equal(later.count, 2);
  console.log('ok  a later, milder refusal never shortens a longer rest');
}

// ---- an expired rest starts afresh with its own reason
{
  const old = nextMetaDelivery(undefined, '131050', 'wamid.X', NOW)!;
  const fresh = nextMetaDelivery({ ...old, until: at(day(-1)) }, '131049', 'wamid.Z', day(5))!;
  assert.equal(fresh.code, '131049');
  assert.equal(fresh.until, at(day(5 + 14)));
  console.log('ok  an expired rest does not carry over its old reason or date');
}

// ---- blocked or not, by date
{
  const attrs = { lifetimeValue: 10, metaDelivery: nextMetaDelivery(undefined, '131049', 'w', NOW)! };
  assert.equal(isMetaBlocked(attrs, day(13)), true);
  assert.equal(isMetaBlocked(attrs, day(14)), false, 'the moment the rest ends they are eligible again');
  assert.equal(isMetaBlocked(attrs, day(20)), false);
  assert.equal(activeMetaDelivery(attrs, day(1))?.code, '131049');
  console.log('ok  blocked until the rest ends, eligible again from that moment');
}

// ---- damaged or missing data never blocks anybody by accident
for (const attrs of [null, undefined, {}, { metaDelivery: null }, { metaDelivery: 'x' }, { metaDelivery: [] }, { metaDelivery: {} }, { metaDelivery: { until: 'not a date' } }, { metaDelivery: { until: '' } }, 'text', 42]) {
  assert.equal(isMetaBlocked(attrs, NOW), false, JSON.stringify(attrs));
}
console.log('ok  missing or malformed data never blocks anyone');

// ---- setting override (used by META_REST_DAYS)
assert.equal(nextMetaDelivery(undefined, '131049', 'w', NOW, { ...REST_DAYS, '131049': 7 })!.until, at(day(7)));
assert.equal(nextMetaDelivery(undefined, '131026', 'w', NOW, { ...REST_DAYS, '131049': 7 })!.until, at(day(30)));
console.log('ok  rest days can be overridden per code');

// ---- clearing: a delivered message settles "undeliverable" only
assert.equal(shouldClearOnDelivery({ metaDelivery: { code: '131026', until: at(day(10)) } }), true);
assert.equal(shouldClearOnDelivery({ metaDelivery: { code: '131049', until: at(day(10)) } }), false);
assert.equal(shouldClearOnDelivery({ metaDelivery: { code: '131050', until: at(day(10)) } }), false);
assert.equal(shouldClearOnDelivery({}), false);
assert.equal(shouldClearOnDelivery(null), false);
console.log('ok  a delivered message clears only an "undeliverable" mark, never a marketing hold-back or opt-out');

console.log('\ndelivery-blocks logic: all checks passed');
