// Run with:  cd apps/api && npx tsx ../web/scripts/broadcastReport.check.ts
import assert from 'node:assert/strict';
import { failureReason, filterCount, REPORT_CSV_HEADER, REPORT_FILTERS, reportCsvRow, STATUS_LABEL } from '../src/lib/broadcastReport';

// ---- filters cover the statuses the server stores, and "Not delivered" means everything not yet delivered
{
  const byKey = Object.fromEntries(REPORT_FILTERS.map(f => [f.key, f.statuses]));
  assert.deepEqual(byKey['not-delivered'], ['QUEUED', 'SENDING', 'SENT', 'FAILED']);
  assert.deepEqual(byKey['delivered'], ['DELIVERED', 'READ'], 'read messages were delivered too');
  const counts = { QUEUED: 1, SENDING: 0, SENT: 2, DELIVERED: 5, READ: 3, FAILED: 4, CANCELLED: 1 };
  assert.equal(filterCount(byKey.all, counts), 16);
  assert.equal(filterCount(byKey['not-delivered'], counts), 7);
  assert.equal(filterCount(byKey['delivered'], counts), 8);
  assert.equal(filterCount(byKey['failed'], counts), 4);
  console.log('ok  report filters and counts');
}

// ---- Meta errors in plain words; unknown codes keep Meta's own text
assert.match(failureReason('131049'), /held back/);
assert.match(failureReason('131026', 'Message undeliverable'), /cannot receive/);
assert.equal(failureReason('999', 'Something odd'), 'Something odd (code 999)');
assert.equal(failureReason('SEND_FAILED', 'Network down'), 'Network down');
assert.equal(failureReason(null, null), 'Failed');
console.log('ok  failure reasons');

// ---- CSV row
{
  const row = reportCsvRow({ id: '1', phone: '919800000001', displayName: 'Asha', status: 'FAILED', errorCode: '131050', sentAt: null });
  assert.equal(row.length, REPORT_CSV_HEADER.length);
  assert.deepEqual(row.slice(0, 3), ['Asha', '+919800000001', STATUS_LABEL.FAILED]);
  assert.match(row[6], /stopped marketing/);
  const ok = reportCsvRow({ id: '2', phone: '919800000002', displayName: '+919800000002', status: 'READ', sentAt: '2026-10-12T10:00:00Z', readAt: '2026-10-12T10:05:00Z' });
  assert.equal(ok[0], '', 'a name that is just the number is left blank');
  assert.equal(ok[6], '', 'no reason unless failed');
  assert.ok(ok[3] && ok[5]);
  console.log('ok  CSV rows');
}
