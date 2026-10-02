// Run with:  cd apps/api && npx tsx ../web/scripts/chatMessage.check.ts
import assert from 'node:assert/strict';
import { attachmentProblem, canEditMessage, outboundKindForMime, roleLabelOf, senderLabel } from '../src/lib/chatMessage';
// The server makes the real decisions: compare against its own logic so the two can never drift apart.
import { decideEdit, outboundKindForMime as serverKind, roleLabel } from '../../api/src/inbox/message-view.logic';
import type { Message } from '../src/types';

const NOW = Date.parse('2026-10-02T10:00:00.000Z');
const min = (n: number) => new Date(NOW + n * 60_000).toISOString();

// ---- file kinds match the server
for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'audio/ogg', 'audio/mpeg', 'application/pdf', '']) {
  assert.equal(outboundKindForMime(mime), serverKind(mime), mime);
}
assert.equal(attachmentProblem({ type: 'image/png', size: 4 * 1024 * 1024 }), null);
assert.match(attachmentProblem({ type: 'image/png', size: 6 * 1024 * 1024 })!, /5 MB/);
assert.equal(attachmentProblem({ type: 'application/pdf', size: 20 * 1024 * 1024 }), null);
console.log('ok  file kinds and size limits match the server');

// ---- role labels match the server
for (const [role, sa] of [['ADMIN', true], ['ADMIN', false], ['AGENT', false], ['MARKETER', false], ['VIEWER', false]] as const) {
  assert.equal(roleLabelOf({ role, isSuperAdmin: sa }), roleLabel(role, sa));
}
assert.equal(senderLabel({ authorName: 'Priya', authorRole: 'Agent' }), 'Priya · Agent');
assert.equal(senderLabel({ authorName: 'Priya' }), 'Priya');
assert.equal(senderLabel({ authorName: 'FGSN Auto-Reply Bot', authorRole: 'Auto-reply' }), 'FGSN Auto-Reply Bot · Auto-reply');
assert.equal(senderLabel({}), null);
console.log('ok  sender labels');

// ---- the Edit button is offered exactly when the server would allow the edit
{
  const agent = { id: 'u1', role: 'AGENT' as const, isSuperAdmin: false };
  const other = { id: 'u2', role: 'AGENT' as const, isSuperAdmin: false };
  const admin = { id: 'u3', role: 'ADMIN' as const, isSuperAdmin: false };
  const msg = (over: Partial<Message> = {}): Message => ({
    id: 'cm1', conversationId: 'c', direction: 'OUTBOUND', status: 'DELIVERED', content: 'hi',
    timestamp: min(-5), authorId: 'u1', ...over,
  });
  const cases: Array<[Message, typeof agent, string | null]> = [
    [msg(), agent, min(60)],
    [msg(), other, min(60)],
    [msg(), admin, min(60)],
    [msg({ timestamp: min(-16) }), agent, min(60)],
    [msg(), agent, min(-1)],
    [msg(), agent, null],
    [msg({ status: 'FAILED' }), agent, min(60)],
    [msg({ templateId: 't' }), agent, min(60)],
    [msg({ mediaType: 'image' }), agent, min(60)],
    [msg({ direction: 'INBOUND' }), admin, min(60)],
    [msg({ isInternalNote: true, timestamp: min(-600) }), agent, null],
    [msg({ isInternalNote: true }), other, null],
  ];
  for (const [m, user, win] of cases) {
    const server = decideEdit({
      direction: m.direction, isInternalNote: !!m.isInternalNote, isTemplate: !!m.templateId, hasMedia: !!m.mediaType,
      status: m.status, sentAt: new Date(m.timestamp), windowExpiresAt: win ? new Date(win) : null,
      authorId: m.authorId, editorId: user.id, editorIsAdmin: user.role === 'ADMIN', now: new Date(NOW),
    });
    assert.equal(canEditMessage(m, user, win, NOW), server.ok, JSON.stringify({ m, user, win }));
  }
  assert.equal(canEditMessage(msg({ id: 'msg_123' }), agent, min(60), NOW), false, 'not saved yet');
  console.log('ok  Edit is offered exactly when the server allows it');
}
