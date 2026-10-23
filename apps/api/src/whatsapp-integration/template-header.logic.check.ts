// Run with: npx tsx src/whatsapp-integration/template-header.logic.check.ts
import assert from 'node:assert/strict';
import { hasHeaderComponent, mediaHeaderOf, withMediaHeader } from './template-header.logic';

// Shape from GET /{waba-id}/message_templates for an image-header template.
const imageTemplate = [
  { type: 'HEADER', format: 'IMAGE', example: { header_handle: ['https://scontent.whatsapp.net/v/t61/abc.jpg?oh=1&oe=2'] } },
  { type: 'BODY', text: '*Register Now!! Limited slots only*' },
  { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Book your slots now!!' }] },
];

assert.deepEqual(mediaHeaderOf(imageTemplate), {
  format: 'IMAGE',
  exampleUrl: 'https://scontent.whatsapp.net/v/t61/abc.jpg?oh=1&oe=2',
});

// Text headers and no header need nothing attached.
assert.equal(mediaHeaderOf([{ type: 'HEADER', format: 'TEXT', text: 'Hi' }, { type: 'BODY', text: 'x' }]), null);
assert.equal(mediaHeaderOf([{ type: 'BODY', text: 'x' }]), null);
assert.equal(mediaHeaderOf(undefined), null);

// A media header with no sample is still reported, so the send can say why it cannot attach one.
assert.deepEqual(mediaHeaderOf([{ type: 'HEADER', format: 'video' }]), { format: 'VIDEO', exampleUrl: null });

// The header goes in front of whatever the caller sent (for example the {{1}} name).
const body = { type: 'body', parameters: [{ type: 'text', text: 'Kamlesh' }] };
assert.deepEqual(withMediaHeader([body], 'IMAGE', 'm1'), [
  { type: 'header', parameters: [{ type: 'image', image: { id: 'm1' } }] },
  body,
]);
assert.deepEqual(withMediaHeader(undefined, 'DOCUMENT', 'm2'), [
  { type: 'header', parameters: [{ type: 'document', document: { id: 'm2' } }] },
]);

// A header the caller chose is never replaced.
const own = [{ type: 'HEADER', parameters: [{ type: 'image', image: { link: 'https://example.com/a.jpg' } }] }];
assert.equal(hasHeaderComponent(own), true);
assert.deepEqual(withMediaHeader(own, 'IMAGE', 'm1'), own);

console.log('template-header.logic: all checks passed');
