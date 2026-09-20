// Run with:  cd apps/api && npx tsx ../web/scripts/templateMatch.check.ts
import assert from 'node:assert/strict';
import { findMatchedTemplate, templateParts } from '../src/lib/templateMatch';
import type { Message, Template } from '../src/types';

const tpl = (over: Partial<Template> & { name: string; body: string; buttons?: any[]; header?: any; footer?: string }): Template =>
  ({
    id: 'id_' + over.name,
    name: over.name,
    language: 'en',
    category: 'MARKETING',
    status: 'APPROVED',
    metaTemplateId: 'meta_' + over.name,
    bodyJson: { body: over.body, buttons: over.buttons, header: over.header, footer: over.footer },
    createdAt: '',
  } as Template);

const msg = (over: Partial<Message>): Message =>
  ({ id: 'm', conversationId: 'c', direction: 'OUTBOUND', status: 'DELIVERED', content: '', timestamp: '', ...over } as Message);

// The message as it appears in the chat (curly apostrophes, extra blank lines) and the template body as Meta stores it.
const SENT = `Well, We’ve got you covered. You enquired about FGSN’s Digital Sports Media Course, and we are getting in touch with you to take this conversation ahead.

Get a chance to be one of the first few students to claim up to a 100% scholarship.

We also offer Internships/job opportunities post your media course.

You could be the next Sports Anchor, commentator, Player Manager, Sponsorship Head, etc all in the Sports Field.`;
const BODY = `Well, We've got you covered. You enquired about FGSN's Digital Sports Media Course, and we are getting in touch with you to take this conversation ahead.\nGet a chance to be one of the first few students to claim up to a 100% scholarship.\nWe also offer Internships/job opportunities post your media course.\nYou could be the next Sports Anchor, commentator, Player Manager, Sponsorship Head, etc all in the Sports Field.`;

const yes = tpl({ name: 'course_enquiry', body: BODY, buttons: [{ type: 'QUICK_REPLY', text: 'Yes' }] });
const welcome = tpl({ name: 'fgsn_account_welcome_notice', body: 'Hello {{1}}, welcome to FGSN. Your account is ready to use.' });

// ---- the case from the screenshot: text only, no template id saved with the message
{
  const p = templateParts(msg({ content: SENT }), [welcome, yes]);
  assert.equal(p.template?.name, 'course_enquiry');
  assert.deepEqual(p.buttons, [{ text: 'Yes', kind: 'reply' }]);
  console.log('ok  message with only its text is matched to its template and gets the Yes button');
}

// ---- matched by the id/name saved with the message
assert.equal(findMatchedTemplate(msg({ content: 'anything', templateId: 'id_course_enquiry' }), [welcome, yes])?.name, 'course_enquiry');
assert.equal(findMatchedTemplate(msg({ content: 'anything', templateId: 'course_enquiry' }), [welcome, yes])?.name, 'course_enquiry');
assert.equal(findMatchedTemplate(msg({ content: 'anything', templateId: 'meta_course_enquiry' }), [welcome, yes])?.name, 'course_enquiry');
console.log('ok  matched by template id, name or Meta id');

// ---- variables in the body: {{1}} is skipped, the fixed text is what identifies it
assert.equal(findMatchedTemplate(msg({ content: 'Hello Asha, welcome to FGSN. Your account is ready to use.' }), [yes, welcome])?.name, 'fgsn_account_welcome_notice');
console.log('ok  a body with {{variables}} still matches');

// ---- never decorate a customer's message, and short replies never match
assert.equal(findMatchedTemplate(msg({ direction: 'INBOUND', content: SENT }), [yes]), undefined);
assert.equal(findMatchedTemplate(msg({ direction: 'INBOUND', content: 'Yes' }), [yes]), undefined);
assert.equal(findMatchedTemplate(msg({ content: 'Yes' }), [yes]), undefined);
assert.equal(findMatchedTemplate(msg({ content: 'Have a great day ahead.' }), [yes, welcome]), undefined);
assert.equal(templateParts(msg({ direction: 'INBOUND', content: SENT }), [yes]).buttons.length, 0);
console.log('ok  customer messages and short/unrelated texts get no template buttons');

// ---- two templates that open with the same words: the better fit wins
{
  const a = tpl({ name: 'offer_a', body: 'Well, We have got you covered. This is the first offer text for you today.', buttons: [{ type: 'QUICK_REPLY', text: 'Yes' }] });
  const b = tpl({ name: 'offer_b', body: 'Well, We have got you covered. This is the second offer text for you today.', buttons: [{ type: 'URL', text: 'Open', url: 'https://x.y' }] });
  assert.equal(findMatchedTemplate(msg({ content: 'Well, We have got you covered. This is the second offer text for you today.' }), [a, b])?.name, 'offer_b');
  assert.equal(findMatchedTemplate(msg({ content: 'Well, We have got you covered. This is the first offer text for you today.' }), [b, a])?.name, 'offer_a');
  console.log('ok  templates with the same opening: the closest match is chosen');
}

// ---- header, footer and button kinds
{
  const rich = tpl({
    name: 'rich',
    body: 'Your order has shipped and will arrive on the date shown below.',
    header: { type: 'TEXT', text: 'Order update' },
    footer: 'FGSN Store',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Thanks' },
      { type: 'URL', text: 'Track order', url: 'https://x.y' },
      { type: 'PHONE_NUMBER', text: 'Call us', phone: '+911234567890' },
      { type: 'COPY_CODE', text: 'Copy code' },
    ],
  });
  const p = templateParts(msg({ content: 'Your order has shipped and will arrive on the date shown below.' }), [rich]);
  assert.equal(p.headerText, 'Order update');
  assert.equal(p.footerText, 'FGSN Store');
  assert.deepEqual(p.buttons.map(b => b.kind), ['reply', 'url', 'phone', 'copy']);
  // an image header has no text to draw
  const img = tpl({ name: 'img', body: 'A long enough body text for matching purposes here.', header: { type: 'IMAGE', url: 'https://x.y/a.png' } });
  assert.equal(templateParts(msg({ content: 'A long enough body text for matching purposes here.' }), [img]).headerText, undefined);
  console.log('ok  header, footer and the four button kinds');
}

// ---- what was saved with the message wins over the template's current definition
{
  const p = templateParts(msg({ content: SENT, buttons: [{ type: 'QUICK_REPLY', text: 'Interested' }], footerText: 'Saved footer' }), [yes]);
  assert.deepEqual(p.buttons, [{ text: 'Interested', kind: 'reply' }]);
  assert.equal(p.footerText, 'Saved footer');
  const strings = templateParts(msg({ content: 'x', buttons: ['Yes', 'No'] as any }), []);
  assert.deepEqual(strings.buttons, [{ text: 'Yes', kind: 'reply' }, { text: 'No', kind: 'reply' }]);
  console.log('ok  buttons saved with the message take priority; plain-text buttons work');
}

// ---- nothing to match against
assert.deepEqual(templateParts(msg({ content: SENT }), []).buttons, []);
assert.equal(templateParts(msg({ content: SENT }), [tpl({ name: 'nobody', body: 'Something else entirely, unrelated text.' })]).template, undefined);
console.log('ok  no templates or no match: plain message, no buttons');

console.log('\ntemplateMatch: all checks passed');
