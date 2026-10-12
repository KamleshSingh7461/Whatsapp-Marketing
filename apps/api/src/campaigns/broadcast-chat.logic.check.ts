// Run with: npx tsx src/campaigns/broadcast-chat.logic.check.ts
import assert from 'node:assert/strict';
import { broadcastText, chatPhone, chatStatusFor } from './broadcast-chat.logic';

assert.equal(broadcastText('Hi {{1}}, classes start Monday', { serverSend: true, name: 'Asha', templateName: 't' }), 'Hi Asha, classes start Monday');
assert.equal(broadcastText('Hi {{1}}!', { serverSend: true, name: '+919800000000', templateName: 't' }), 'Hi there!');
assert.equal(broadcastText('Hi {{1}}!', { serverSend: true, name: null, templateName: 't' }), 'Hi there!');
assert.equal(broadcastText('Hi {{1}}!', { serverSend: false, name: 'Asha', templateName: 't' }), 'Hi {{1}}!', 'browser-sent: as sent');
assert.equal(broadcastText('  ', { serverSend: false, templateName: 'fgsn_learn' }), '[Template: fgsn_learn]');
console.log('ok  broadcast text as the person received it');

assert.equal(chatStatusFor('READ'), 'READ');
assert.equal(chatStatusFor('DELIVERED'), 'DELIVERED');
assert.equal(chatStatusFor('SENT'), 'SENT');
assert.equal(chatStatusFor('SENDING'), 'SENT');
assert.equal(chatStatusFor('FAILED'), 'FAILED');
console.log('ok  delivery state becomes the chat tick');

assert.equal(chatPhone('+91 98100 00000'), '919810000000');
assert.equal(chatPhone('9810000000'), '919810000000');
assert.equal(chatPhone('447700900123'), '447700900123');
console.log('ok  phone formats');
