// Run with: npx tsx src/whatsapp-integration/meta-insights.check.ts
import assert from 'node:assert/strict';
import { buildWindow, clampDays, groupPricing, localDay, sumMessageAnalytics } from './meta-insights';

// Shape copied from Meta's docs (pricing_analytics), with the numbers from the WhatsApp Manager screenshot:
// 495 paid Marketing messages costing 431.02, and 67 free customer-service messages.
const pricingResponse = {
  data: [
    {
      data_points: [
        { start: 1, end: 2, pricing_type: 'REGULAR', pricing_category: 'MARKETING', volume: 300, cost: 261.22 },
        { start: 2, end: 3, pricing_type: 'REGULAR', pricing_category: 'MARKETING', volume: 195, cost: 169.8 },
        { start: 1, end: 3, pricing_type: 'FREE_CUSTOMER_SERVICE', pricing_category: 'SERVICE', volume: 67, cost: 0 },
      ],
    },
  ],
};

const grouped = groupPricing(pricingResponse.data);
assert.equal(grouped.MARKETING.REGULAR.volume, 495);
assert.equal(grouped.MARKETING.REGULAR.cost, 431.02);
assert.equal(grouped.SERVICE.FREE_CUSTOMER_SERVICE.volume, 67);
assert.equal(grouped.SERVICE.FREE_CUSTOMER_SERVICE.cost, 0);
assert.equal(grouped.UTILITY, undefined);

// Float noise must not leak (0.1 + 0.2 style sums).
const noisy = groupPricing([{ data_points: [
  { pricing_category: 'UTILITY', pricing_type: 'REGULAR', volume: 1, cost: 0.1 },
  { pricing_category: 'UTILITY', pricing_type: 'REGULAR', volume: 1, cost: 0.2 },
] }]);
assert.equal(noisy.UTILITY.REGULAR.cost, 0.3);

// Missing or malformed input never throws and yields zeros.
assert.deepEqual(groupPricing(undefined), {});
assert.deepEqual(groupPricing([{}]), {});
assert.deepEqual(groupPricing([{ data_points: [{ volume: 'x' as any, cost: NaN }] }]), { UNKNOWN: { REGULAR: { volume: 0, cost: 0 } } });

// Message analytics: Meta's documented shape, summed across days.
assert.deepEqual(
  sumMessageAnalytics([{ sent: 300, delivered: 280 }, { sent: 324, delivered: 282 }]),
  { sent: 624, delivered: 562 },
);
assert.deepEqual(sumMessageAnalytics(undefined), { sent: 0, delivered: 0 });
assert.deepEqual(sumMessageAnalytics([{}, { sent: 5 }]), { sent: 5, delivered: 0 });

// Day range clamp. 0 means "today so far"; missing or invalid means 28.
assert.equal(clampDays('28'), 28);
assert.equal(clampDays(7), 7);
assert.equal(clampDays(9999), 90);
assert.equal(clampDays(0), 0);
assert.equal(clampDays('0'), 0);
assert.equal(clampDays(''), 28);
assert.equal(clampDays(null), 28);
assert.equal(clampDays(-3), 28);
assert.equal(clampDays('abc'), 28);
assert.equal(clampDays(undefined), 28);
assert.equal(clampDays(6.9), 6);

// The window must be WhatsApp Manager's: at 22:15 IST on 19 Sep 2026, "last 28 days" is 22 Aug 00:00 IST
// to 18 Sep 23:59:59 IST. (Checked against Meta: that exact window returned Manager's 624 / 562 / 431.02.)
const nowIst = Date.UTC(2026, 8, 19, 22, 15) / 1000 - 330 * 60; // 22:15 IST expressed as UTC seconds
const w28 = buildWindow(nowIst, 28);
assert.equal(new Date(w28.start * 1000).toISOString(), '2026-08-21T18:30:00.000Z'); // 22 Aug 00:00 IST
assert.equal(new Date(w28.end * 1000).toISOString(), '2026-09-18T18:29:59.000Z');   // 18 Sep 23:59:59 IST
assert.equal(localDay(w28.start), '2026-08-22');
assert.equal(localDay(w28.end), '2026-09-18');
assert.equal((w28.end + 1 - w28.start) / 86400, 28); // exactly 28 whole days

const today = buildWindow(nowIst, 0);
assert.equal(new Date(today.start * 1000).toISOString(), '2026-09-18T18:30:00.000Z'); // 19 Sep 00:00 IST
assert.equal(today.end, nowIst);

// Just after midnight IST the window rolls forward a day (still whole days, still ending "yesterday").
const justAfterMidnight = Date.UTC(2026, 8, 19, 18, 31) / 1000; // 20 Sep 00:01 IST
assert.equal(localDay(buildWindow(justAfterMidnight, 7).end), '2026-09-19');
assert.equal(localDay(buildWindow(justAfterMidnight, 7).start), '2026-09-13');

console.log('meta-insights: all checks passed');
