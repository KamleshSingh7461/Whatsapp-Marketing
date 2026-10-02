// Run with: npx tsx src/inbox/message-view.logic.check.ts
import assert from 'node:assert/strict';
import {
  correctionText,
  decideEdit,
  EditCheckInput,
  inboundFallbackText,
  inboundMediaOf,
  outboundKindForMime,
  parseDataUrl,
  roleLabel,
  storedMediaOf,
} from './message-view.logic';

// ---- inbound attachments of every kind are recognised
{
  assert.deepEqual(inboundMediaOf({ type: 'image', image: { id: 'm1', mime_type: 'image/jpeg', caption: 'hi' } }), {
    mediaId: 'm1', mediaUrl: '/api/whatsapp/media/m1', mediaType: 'image', mimeType: 'image/jpeg', fileName: undefined, caption: 'hi',
  });
  const doc = inboundMediaOf({ type: 'document', document: { id: 'd1', filename: 'bill.pdf', mime_type: 'application/pdf' } })!;
  assert.equal(doc.mediaType, 'document'); assert.equal(doc.fileName, 'bill.pdf');
  assert.equal(inboundMediaOf({ type: 'audio', audio: { id: 'a1', voice: true } })!.mediaType, 'audio');
  assert.equal(inboundMediaOf({ type: 'video', video: { id: 'v1' } })!.mediaType, 'video');
  assert.equal(inboundMediaOf({ type: 'sticker', sticker: { id: 's1' } })!.mediaType, 'sticker');
  assert.equal(inboundMediaOf({ type: 'text', text: { body: 'x' } }), null);
  console.log('ok  inbound image, document, audio, video and sticker are recognised; text is not media');
}

// ---- fallback text
{
  assert.equal(inboundFallbackText({ type: 'audio', audio: { id: 'a', voice: true } }), 'Voice message');
  assert.equal(inboundFallbackText({ type: 'document', document: { id: 'd', filename: 'a.pdf' } }), 'a.pdf');
  assert.match(inboundFallbackText({ type: 'location', location: { latitude: 1, longitude: 2 } }), /maps\.google\.com\/\?q=1,2/);
  assert.equal(inboundFallbackText({ type: 'unknownthing' }), '[UNKNOWNTHING Message]');
  console.log('ok  messages without text get a readable label');
}

// ---- stored messages: older rows read their attachment from payload.raw; data: URLs are never served
{
  const old = storedMediaOf({ body: '[DOCUMENT Message]', raw: { type: 'document', document: { id: 'd9', filename: 'x.pdf' } } });
  assert.equal(old.mediaUrl, '/api/whatsapp/media/d9'); assert.equal(old.mediaType, 'document'); assert.equal(old.fileName, 'x.pdf');
  const img = storedMediaOf({ mediaUrl: '/api/whatsapp/media/i1', mediaType: 'image' });
  assert.equal(img.mediaUrl, '/api/whatsapp/media/i1');
  assert.equal(storedMediaOf({ mediaUrl: 'data:image/png;base64,AAAA' }).mediaUrl, undefined);
  assert.equal(storedMediaOf({ body: 'hello' }).mediaType, undefined);
  console.log('ok  stored attachments are found, including on messages saved before this change');
}

// ---- outbound kinds and data URLs
{
  assert.equal(outboundKindForMime('image/png'), 'image');
  assert.equal(outboundKindForMime('image/webp'), 'document');
  assert.equal(outboundKindForMime('video/mp4'), 'video');
  assert.equal(outboundKindForMime('audio/ogg'), 'audio');
  assert.equal(outboundKindForMime('application/pdf'), 'document');
  const parsed = parseDataUrl('data:application/pdf;base64,' + Buffer.from('hello').toString('base64'))!;
  assert.equal(parsed.mime, 'application/pdf'); assert.equal(parsed.bytes.toString(), 'hello');
  assert.equal(parseDataUrl('https://example.com/a.png'), null);
  console.log('ok  files are sent as the kind Meta accepts (only JPEG/PNG as photos)');
}

// ---- role labels
assert.equal(roleLabel('ADMIN', true), 'Super Admin');
assert.equal(roleLabel('ADMIN', false), 'Admin');
assert.equal(roleLabel('AGENT'), 'Agent');
assert.equal(roleLabel(undefined), undefined);
console.log('ok  role labels');

// ---- edit rules
{
  const now = new Date('2026-10-02T10:00:00Z');
  const base: EditCheckInput = {
    direction: 'OUTBOUND', isInternalNote: false, isTemplate: false, hasMedia: false, status: 'DELIVERED',
    sentAt: new Date(now.getTime() - 5 * 60_000), windowExpiresAt: new Date(now.getTime() + 3600_000),
    authorId: 'u1', editorId: 'u1', editorIsAdmin: false, now,
  };
  assert.deepEqual(decideEdit(base), { ok: true, sendToCustomer: true });
  assert.equal(decideEdit({ ...base, editorId: 'u2' }).ok, false, 'someone else');
  assert.deepEqual(decideEdit({ ...base, editorId: 'u2', editorIsAdmin: true }), { ok: true, sendToCustomer: true });
  assert.equal(decideEdit({ ...base, direction: 'INBOUND' }).ok, false);
  assert.equal(decideEdit({ ...base, isTemplate: true }).ok, false);
  assert.equal(decideEdit({ ...base, hasMedia: true }).ok, false);
  assert.equal(decideEdit({ ...base, status: 'FAILED' }).ok, false);
  assert.equal(decideEdit({ ...base, sentAt: new Date(now.getTime() - 16 * 60_000) }).ok, false, 'after 15 minutes');
  assert.equal(decideEdit({ ...base, windowExpiresAt: new Date(now.getTime() - 1) }).ok, false, 'window closed: nothing sent');
  assert.equal(decideEdit({ ...base, windowExpiresAt: null }).ok, false);
  // notes: any time, never sent to the customer
  assert.deepEqual(
    decideEdit({ ...base, isInternalNote: true, sentAt: new Date(0), windowExpiresAt: null }),
    { ok: true, sendToCustomer: false },
  );
  assert.equal(correctionText('new'), '✏️ Correction: new');
  console.log('ok  edits: own message or admin, 15 minutes, open 24h window only; notes any time and never sent');
}
