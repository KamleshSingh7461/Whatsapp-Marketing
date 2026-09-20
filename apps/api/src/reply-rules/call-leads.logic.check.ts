// Run with: npx tsx src/reply-rules/call-leads.logic.check.ts
import assert from 'node:assert/strict';
import {
  aggregatePeople,
  CALL_STATUSES,
  CALL_STATUS_LABELS,
  clampOverviewDays,
  countByStatus,
  isCallStatus,
  validateCallUpdate,
} from './call-leads.logic';

// ---- the four statuses the team works with
assert.deepEqual([...CALL_STATUSES], ['CALL_PENDING', 'CALLED_NOT_PICKED', 'CALL_DONE', 'FOLLOW_UP_PENDING']);
assert.deepEqual(Object.values(CALL_STATUS_LABELS), ['Call pending', 'Called, not picked', 'Call done', 'Follow up pending']);
assert.equal(isCallStatus('CALL_DONE'), true);
assert.equal(isCallStatus('SOLD'), false);
assert.equal(isCallStatus(undefined), false);

// ---- validating an update
const pending = { callStatus: 'CALL_PENDING' as const, remarks: null };
const good = validateCallUpdate({ status: 'CALLED_NOT_PICKED', remarks: '  no   answer  ' }, pending);
assert.ok(good.ok);
if (good.ok) assert.deepEqual(good.value, { status: 'CALLED_NOT_PICKED', remarks: 'no answer' });
const noRemark = validateCallUpdate({ status: 'CALL_DONE' }, pending);
assert.ok(noRemark.ok && noRemark.value.remarks === null);
assert.ok(validateCallUpdate({ status: 'CALL_DONE', remarks: '   ' }, pending).ok); // blank remark is just "no remark"
assert.equal(validateCallUpdate({ status: 'CALL_PENDING' }, pending).ok, false); // same status, nothing said
assert.equal(validateCallUpdate({ status: 'CALL_PENDING', remarks: 'note' }, pending).ok, true); // same status + a note is fine
assert.equal(validateCallUpdate({ status: 'CALL_DONE', remarks: 'x'.repeat(500) }, pending).ok, true);
assert.equal(validateCallUpdate({ status: 'CALL_DONE', remarks: 'x'.repeat(501) }, pending).ok, false);
assert.equal(validateCallUpdate({ status: 'nope' }, pending).ok, false);
assert.equal(validateCallUpdate({}, pending).ok, false);
assert.equal(validateCallUpdate(null, pending).ok, false);
assert.equal(validateCallUpdate({ status: ['CALL_DONE'] }, pending).ok, false);
assert.equal(validateCallUpdate({ status: 'CALL_DONE', remarks: 42 }, pending).ok, true); // a non-text remark is ignored, not trusted

// ---- period for the managers' overview
assert.equal(clampOverviewDays(1), 1);
assert.equal(clampOverviewDays('30'), 30);
assert.equal(clampOverviewDays(7), 7);
assert.equal(clampOverviewDays(90), 7);
assert.equal(clampOverviewDays(undefined), 7);
assert.equal(clampOverviewDays('abc'), 7);

// ---- per-person summary
const t = (h: number) => new Date(2026, 8, 20, h);
const people = aggregatePeople([
  { byUserId: 'a', byName: 'Asha Verma', byRole: 'ADMIN', status: 'CALL_DONE', leadId: 'L1', createdAt: t(10) },
  { byUserId: 'a', byName: 'Asha Verma', byRole: 'ADMIN', status: 'CALL_DONE', leadId: 'L2', createdAt: t(11) },
  { byUserId: 'a', byName: 'Asha Verma', byRole: 'ADMIN', status: 'FOLLOW_UP_PENDING', leadId: 'L2', createdAt: t(12) },
  { byUserId: 'r', byName: 'Ravi Nair', byRole: 'MARKETER', status: 'CALLED_NOT_PICKED', leadId: 'L3', createdAt: t(9) },
  { byUserId: 'r', byName: 'Ravi N.', byRole: 'MARKETER', status: 'CALLED_NOT_PICKED', leadId: 'L3', createdAt: t(13) }, // renamed later
]);
assert.deepEqual(people.map(p => p.userId), ['a', 'r']); // busiest first
assert.equal(people[0].updates, 3);
assert.equal(people[0].leadsTouched, 2); // L2 counted once even though updated twice
assert.deepEqual(people[0].byStatus, { CALL_PENDING: 0, CALLED_NOT_PICKED: 0, CALL_DONE: 2, FOLLOW_UP_PENDING: 1 });
assert.equal(people[0].lastActiveAt.getTime(), t(12).getTime());
assert.equal(people[1].name, 'Ravi N.'); // the newest name wins
assert.equal(people[1].leadsTouched, 1);
assert.deepEqual(aggregatePeople([]), []);

// ---- counts always carry all four statuses
assert.deepEqual(countByStatus([]), { CALL_PENDING: 0, CALLED_NOT_PICKED: 0, CALL_DONE: 0, FOLLOW_UP_PENDING: 0 });
assert.deepEqual(countByStatus([{ status: 'CALL_DONE', count: 2 }, { status: 'CALL_DONE', count: 3 }, { status: 'CALL_PENDING', count: 1 }]),
  { CALL_PENDING: 1, CALLED_NOT_PICKED: 0, CALL_DONE: 5, FOLLOW_UP_PENDING: 0 });

console.log('call-leads logic: all checks passed');
