// Run with: npx tsx scripts/waFormat.check.ts
import assert from 'node:assert/strict';
import { parseWaFormatting, stripWaFormatting, wrapSelection } from '../src/lib/waFormat';

const p = parseWaFormatting;

// The usual marks
assert.deepEqual(p('Hi *Kamlesh*!'), [{ text: 'Hi ' }, { text: 'Kamlesh', bold: true }, { text: '!' }]);
assert.deepEqual(p('_soon_'), [{ text: 'soon', italic: true }]);
assert.deepEqual(p('~₹199~ ₹99'), [{ text: '₹199', strike: true }, { text: ' ₹99' }]);
assert.deepEqual(p('code `FGSN20` now'), [{ text: 'code ' }, { text: 'FGSN20', mono: true }, { text: ' now' }]);
assert.deepEqual(p('```a *b*\nc```'), [{ text: 'a *b*\nc', mono: true }]);
console.log('ok  bold, italic, strikethrough, monospace');

// Combined
assert.deepEqual(p('*_both_*'), [{ text: 'both', bold: true, italic: true }]);
assert.deepEqual(p('*Wed, 04 Nov* · _4 PM_'), [
  { text: 'Wed, 04 Nov', bold: true },
  { text: ' · ' },
  { text: '4 PM', italic: true },
]);
console.log('ok  combined marks');

// Left as typed, like on the phone
assert.deepEqual(p('5*3*2 = 30'), [{ text: '5*3*2 = 30' }]);
assert.deepEqual(p('file_name_v2.pdf'), [{ text: 'file_name_v2.pdf' }]);
assert.deepEqual(p('* not bold *'), [{ text: '* not bold *' }]);
assert.deepEqual(p('*open\nclose*'), [{ text: '*open\nclose*' }]);
assert.deepEqual(p('a ** b'), [{ text: 'a ** b' }]);
assert.deepEqual(p(''), []);
console.log('ok  marks inside words, with spaces, or across lines stay as typed');

// The template from the masterclass broadcast
const body = '*What you will learn*\n• How the industry works\n🗓 *Wednesday, 04 November*';
assert.equal(stripWaFormatting(body), 'What you will learn\n• How the industry works\n🗓 Wednesday, 04 November');
assert.equal(p(body).filter(s => s.bold).length, 2);
console.log('ok  a full template body');

// The editor's B / I buttons
assert.deepEqual(wrapSelection('Book now', 0, 4, '*'), { value: '*Book* now', start: 1, end: 5 });
assert.deepEqual(wrapSelection('Book now ', 5, 9, '_'), { value: 'Book _now_ ', start: 6, end: 9 });
assert.deepEqual(wrapSelection('Hi ', 3, 3, '*'), { value: 'Hi **', start: 4, end: 4 });
assert.deepEqual(wrapSelection('*Book* now', 1, 5, '*'), { value: 'Book now', start: 0, end: 4 });
console.log('ok  wrapping and unwrapping the selection');

console.log('\nwaFormat: all checks passed');
