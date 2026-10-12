// Run with: npx tsx src/auth/invite-status.logic.check.ts
import assert from 'node:assert/strict';
import { inviteStatus, inviteUsable, REVOKED_PREFIX, revokedToken } from './invite-status.logic';

const NOW = new Date('2026-10-12T12:00:00Z');
const later = new Date(NOW.getTime() + 86400000);
const earlier = new Date(NOW.getTime() - 1000);

assert.equal(inviteStatus({ token: 'abc', usedAt: null, expiresAt: later }, NOW), 'PENDING');
assert.equal(inviteStatus({ token: 'abc', usedAt: null, expiresAt: earlier }, NOW), 'EXPIRED');
assert.equal(inviteStatus({ token: revokedToken(), usedAt: null, expiresAt: later }, NOW), 'REVOKED', 'revoked even if not yet expired');
assert.equal(inviteStatus({ token: 'abc', usedAt: earlier, expiresAt: later }, NOW), 'ACCEPTED');
console.log('ok  invite status');

assert.equal(inviteUsable({ token: 'abc', usedAt: null, expiresAt: later }, NOW), true);
assert.equal(inviteUsable({ token: revokedToken(), usedAt: null, expiresAt: later }, NOW), false, 'revoked link never works');
assert.equal(inviteUsable({ token: 'abc', usedAt: null, expiresAt: earlier }, NOW), false);
assert.equal(inviteUsable({ token: 'abc', usedAt: earlier, expiresAt: later }, NOW), false, 'a link works once');
assert.equal(inviteUsable(null, NOW), false);
console.log('ok  only pending invites can be used');

const a = revokedToken();
const b = revokedToken();
assert.ok(a.startsWith(REVOKED_PREFIX) && a.length > 40 && a !== b, 'revoked tokens are unique and unguessable');
console.log('ok  revoked tokens');
