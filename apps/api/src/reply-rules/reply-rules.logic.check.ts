// Run with: npx tsx src/reply-rules/reply-rules.logic.check.ts
import assert from 'node:assert/strict';
import {
  buttonMatches,
  cleanTagList,
  extractButtonTap,
  mergeTags,
  normalizeLabel,
  pickMatchingRules,
  RuleLike,
  validateRuleInput,
} from './reply-rules.logic';

// The exact inbound shape from Meta's "button" webhook reference (a tap on a template quick-reply button).
const metaTap = {
  from: '16315551181',
  id: 'wamid.ABGGFlA5Fpa',
  timestamp: '1504902988',
  type: 'button',
  button: { payload: 'Unsubscribe', text: 'Unsubscribe' },
  context: { from: '15550783881', id: 'wamid.HBgLMTQxMjU1NTA4MjkVAgASGBQzQUNCNjk5RDUwNUZGMUZEM0VBRAA=' },
};

// ---- extractButtonTap
assert.deepEqual(extractButtonTap(metaTap), {
  labels: ['Unsubscribe'],
  contextMessageId: 'wamid.HBgLMTQxMjU1NTA4MjkVAgASGBQzQUNCNjk5RDUwNUZGMUZEM0VBRAA=',
});
// A custom payload that differs from the label: both are kept, so a rule can match either.
assert.deepEqual(extractButtonTap({ ...metaTap, button: { text: 'Yes, call me', payload: 'LEAD_YES' } })?.labels, ['Yes, call me', 'LEAD_YES']);
// No context (older clients, forwarded messages): still a tap, just without the source message.
assert.equal(extractButtonTap({ ...metaTap, context: undefined })?.contextMessageId, undefined);
// The decision: typing the word is NOT a button tap.
assert.equal(extractButtonTap({ type: 'text', text: { body: 'yes' } }), null);
assert.equal(extractButtonTap({ type: 'interactive', interactive: { type: 'button_reply', button_reply: { title: 'Yes' } } }), null);
assert.equal(extractButtonTap({ type: 'button', button: {} }), null);
assert.equal(extractButtonTap(null), null);
assert.equal(extractButtonTap(undefined), null);

// ---- normalizeLabel
assert.equal(normalizeLabel('Yes'), 'yes');
assert.equal(normalizeLabel('  YES  '), 'yes');
assert.equal(normalizeLabel('Yes please'), 'yes please'); // non-breaking space
assert.equal(normalizeLabel('Ｙｅｓ'), 'yes'); // full-width letters
assert.equal(normalizeLabel('हाँ'), normalizeLabel('हाँ')); // other scripts pass through unchanged
assert.notEqual(normalizeLabel('Yes,'), normalizeLabel('Yes')); // punctuation is significant: no fuzzy matching
assert.equal(normalizeLabel(null), '');

// ---- rule matching
const at = (n: number) => new Date(2026, 8, n);
const rule = (over: Partial<RuleLike>): RuleLike => ({
  id: 'r', name: 'r', templateName: null, buttonText: 'Yes', tags: [], replyText: null, active: true, createdAt: at(1), ...over,
});
const generalYes = rule({ id: 'default', templateName: null, buttonText: 'Yes', createdAt: at(1) });

// The seeded default: a "Yes" tap on any template, including one we could not identify.
assert.deepEqual(pickMatchingRules([generalYes], 'summer_sale', ['Yes']).map(r => r.id), ['default']);
assert.deepEqual(pickMatchingRules([generalYes], null, ['yes']).map(r => r.id), ['default']);
// Different wording is a different button: a new template needs its own rule (that is the point).
assert.deepEqual(pickMatchingRules([generalYes], 'summer_sale', ['Interested']), []);
// Matching on the payload works too.
assert.deepEqual(pickMatchingRules([rule({ buttonText: 'LEAD_YES' })], null, ['Yes, call me', 'LEAD_YES']).length, 1);
// Paused rules never fire.
assert.deepEqual(pickMatchingRules([rule({ active: false })], null, ['Yes']), []);
// A rule for a named template only fires for that template, ignoring case; it never fires when the template is unknown.
const forTournament = rule({ id: 'tourney', templateName: 'Tournament_Promo', buttonText: 'Interested', createdAt: at(2) });
assert.deepEqual(pickMatchingRules([forTournament], 'tournament_promo', ['interested']).map(r => r.id), ['tourney']);
assert.deepEqual(pickMatchingRules([forTournament], 'other_template', ['Interested']), []);
assert.deepEqual(pickMatchingRules([forTournament], null, ['Interested']), []);
// Specific beats general: a rule for this template replaces the "any template" rule for the same button.
const specificYes = rule({ id: 'specific', templateName: 'course_offer', buttonText: 'Yes', createdAt: at(3) });
assert.deepEqual(pickMatchingRules([generalYes, specificYes], 'course_offer', ['Yes']).map(r => r.id), ['specific']);
assert.deepEqual(pickMatchingRules([generalYes, specificYes], 'summer_sale', ['Yes']).map(r => r.id), ['default']);
// Two rules on the same template and button both apply, oldest first.
const a = rule({ id: 'a', templateName: 't', createdAt: at(5) });
const b = rule({ id: 'b', templateName: 't', createdAt: at(4) });
assert.deepEqual(pickMatchingRules([a, b], 't', ['Yes']).map(r => r.id), ['b', 'a']);
assert.equal(buttonMatches({ buttonText: '  ' }, ['  ']), false); // an empty rule button never matches

// ---- tags
assert.deepEqual(mergeTags(['New Lead'], ['Hot Lead', 'New Lead']), ['New Lead', 'Hot Lead']);
assert.deepEqual(mergeTags(null, ['A']), ['A']);
assert.deepEqual(cleanTagList('Hot Lead, hot lead ,  , Tournament '), ['Hot Lead', 'Tournament']);
assert.deepEqual(cleanTagList(['a', 'A', ' b ']), ['a', 'b']);
assert.equal(cleanTagList(Array.from({ length: 30 }, (_, i) => `t${i}`)).length, 10);
assert.deepEqual(cleanTagList(undefined), []);

// ---- validation
const ok = validateRuleInput({ name: ' Tournament interest ', templateName: ' tournament_promo ', buttonText: ' Interested ', tags: 'Hot Lead, Tournament', replyText: '  Thanks!  ' });
assert.ok(ok.ok);
if (ok.ok) {
  assert.equal(ok.value.name, 'Tournament interest');
  assert.equal(ok.value.templateName, 'tournament_promo');
  assert.equal(ok.value.buttonText, 'Interested');
  assert.deepEqual(ok.value.tags, ['Hot Lead', 'Tournament']);
  assert.equal(ok.value.replyText, 'Thanks!');
  assert.equal(ok.value.active, true);
}
const blankTemplate = validateRuleInput({ name: 'n', buttonText: 'Yes', templateName: '  ', replyText: '   ' });
assert.ok(blankTemplate.ok && blankTemplate.value.templateName === null && blankTemplate.value.replyText === null);
assert.equal(validateRuleInput({ buttonText: 'Yes' }).ok, false); // name required
assert.equal(validateRuleInput({ name: 'x' }).ok, false); // button required
assert.equal(validateRuleInput({ name: 'x'.repeat(81), buttonText: 'Yes' }).ok, false);
assert.equal(validateRuleInput({ name: 'x', buttonText: 'Yes', replyText: 'z'.repeat(1001) }).ok, false);
assert.equal(validateRuleInput(null).ok, false);
// Partial update: only what was sent is checked and returned (so pausing a rule cannot wipe its other fields).
const pause = validateRuleInput({ active: false }, true);
assert.ok(pause.ok);
if (pause.ok) assert.deepEqual(pause.value, { active: false });
assert.equal(validateRuleInput({ active: 'no' }, true).ok, false);
assert.equal(validateRuleInput({ name: '   ' }, true).ok, false);

console.log('reply-rules logic: all checks passed');
