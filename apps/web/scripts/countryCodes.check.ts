// Run with:  cd apps/api && npx tsx ../web/scripts/countryCodes.check.ts
// (the API project already has the tsx runner; this file is outside web/src so the web build ignores it)
import assert from 'node:assert/strict';
import {
  cleanPhoneWithCountry,
  formatPhoneInput,
  formatPhoneNumber,
  maxLocalDigits,
  nationalDigits,
  POPULAR_COUNTRY_CODES,
  validatePhoneNumber,
} from '../src/lib/countryCodes';

const ok = (code: string, input: string) => {
  const v = validatePhoneNumber(code, input);
  assert.equal(v.isValid, true, `${code} ${JSON.stringify(input)} should be valid, got: ${v.message}`);
};
const bad = (code: string, input: string, messagePart?: string) => {
  const v = validatePhoneNumber(code, input);
  assert.equal(v.isValid, false, `${code} ${JSON.stringify(input)} should be INVALID`);
  if (messagePart) assert.match(v.message, new RegExp(messagePart, 'i'), `${code} ${JSON.stringify(input)}: ${v.message}`);
};

// ---- the case from the screenshot: letters are not a phone number
bad('+91', 'asdasdasfa', 'Enter the 10-digit');
assert.equal(cleanPhoneWithCountry('+91', 'asdasdasfa'), '');
assert.equal(formatPhoneNumber('+91', 'asdasdasfa'), '');
bad('+91', '', 'Enter the 10-digit');
bad('+91', '   ');
bad('+91', '!!!---');

// ---- India
ok('+91', '9876543210');
ok('+91', '98765 43210');
ok('+91', '+91 98765 43210');
ok('+91', '919876543210');
ok('+91', '09876543210'); // local leading 0
ok('+91', '098765 43210');
bad('+91', '1234567890', 'start with 6, 7, 8 or 9'); // wrong first digit, said immediately
bad('+91', '1', 'start with 6, 7, 8 or 9');
bad('+91', '98765', '5 more digits');
bad('+91', '987654321', '1 more digit ');
bad('+91', '98765432101', 'Too long'); // 11 digits, no country code, no trunk 0
bad('+91', '5876543210', 'start with 6');
// regression: a local number must not be chopped or mistaken for a country code
assert.equal(formatPhoneNumber('+91', '09876543210'), '98765 43210'); // used to become "09876 54321" (last digit lost)
assert.equal(formatPhoneNumber('+91', '9123456789'), '91234 56789'); // starts with "91" but is a plain local number
ok('+91', '9123456789');
assert.equal(cleanPhoneWithCountry('+91', '09876543210'), '919876543210');
assert.equal(cleanPhoneWithCountry('+91', '+91 98765 43210'), '919876543210');
assert.equal(cleanPhoneWithCountry('+91', '9876543210'), '919876543210');
assert.equal(nationalDigits('+91', 'a9b8c7d6e5f4g3h2i1j0'), '9876543210');
// pasted digits are never silently cut: too long shows as an error instead
assert.equal(formatPhoneNumber('+91', '98765432109999'), '98765 432109999');
bad('+91', formatPhoneNumber('+91', '98765432109999'), 'Too long');

// ---- United States / Canada
ok('+1', '2025550123');
ok('+1', '(202) 555-0123');
ok('+1', '12025550123');
ok('+1', '+1 202 555 0123');
bad('+1', '1025550123', 'starts with 2 to 9'); // area code cannot start with 0 or 1
bad('+1', '2021550123', '4th digit'); // exchange cannot start with 0 or 1
bad('+1', '202555', 'more digits');
assert.equal(formatPhoneNumber('+1', '2025550123'), '(202) 555-0123');

// ---- United Kingdom
ok('+44', '7911123456');
ok('+44', '07911 123456');
ok('+44', '+44 7911 123456');
bad('+44', '2079460000', 'start with 7');
assert.equal(cleanPhoneWithCountry('+44', '07911123456'), '447911123456');

// ---- Gulf, Asia-Pacific, Europe, Africa (first-digit and length rules)
ok('+971', '501234567'); ok('+971', '0501234567'); bad('+971', '401234567', 'start with 5');
ok('+966', '512345678'); bad('+966', '612345678', 'start with 5');
ok('+65', '81234567'); ok('+65', '91234567'); bad('+65', '61234567', 'start with 8 or 9'); bad('+65', '812345678', 'Too long');
ok('+61', '412345678'); ok('+61', '0412345678'); bad('+61', '312345678', 'start with 4');
ok('+49', '15123456789'); ok('+49', '1512345678'); bad('+49', '25123456789', 'start with 1'); bad('+49', '151234567', 'more digit');
ok('+33', '612345678'); ok('+33', '0612345678'); bad('+33', '512345678', 'start with 6 or 7');
ok('+34', '612345678'); bad('+34', '512345678', 'start with 6 or 7');
ok('+92', '3001234567'); ok('+92', '03001234567'); bad('+92', '2001234567', 'start with 3');
ok('+880', '1712345678'); ok('+880', '01712345678'); bad('+880', '2712345678', 'start with 1');
ok('+977', '9841234567'); bad('+977', '8841234567', 'start with 9');
ok('+94', '712345678'); ok('+94', '0712345678'); bad('+94', '512345678', 'start with 7');
ok('+27', '821234567'); ok('+27', '0821234567'); bad('+27', '521234567', 'start with 6, 7 or 8');
ok('+234', '8021234567'); ok('+234', '08021234567'); bad('+234', '5021234567', 'start with 7, 8 or 9');
ok('+254', '712345678'); ok('+254', '112345678'); ok('+254', '0712345678'); bad('+254', '512345678', 'start with 7 or 1');

// ---- a country without its own rule: only the international standard (7 to 15 digits with the code)
ok('+81', '9012345678');
bad('+81', '123456', 'more digit');
bad('+81', '1234567890123456', 'Too long');

// ---- every country in the dropdown has a rule and a sample that passes its own rule
for (const c of POPULAR_COUNTRY_CODES) {
  const v = validatePhoneNumber(c.code, c.sampleDigits);
  assert.equal(v.isValid, true, `the sample number shown for ${c.name} (${c.code}) must be valid, got: ${v.message}`);
}

// ---- status: only real mistakes are 'invalid'; an unfinished number is 'incomplete' (screens stay calm while typing)
assert.equal(validatePhoneNumber('+91', '').status, 'incomplete');
assert.equal(validatePhoneNumber('+91', '98765').status, 'incomplete');
assert.equal(validatePhoneNumber('+91', '9876543210').status, 'valid');
assert.equal(validatePhoneNumber('+91', '1234567890').status, 'invalid');
assert.equal(validatePhoneNumber('+91', '98765432101').status, 'invalid');
assert.equal(validatePhoneNumber('+91', 'asdasd').status, 'incomplete');
assert.equal(validatePhoneNumber('+81', '9012345678').status, 'valid');
// wording: "An Indian", "A UK"
bad('+91', '98765432101', 'An Indian mobile number has 10 digits');
bad('+44', '79111234567', 'A UK mobile number has 10 digits');

// ---- typing stops at a full number (keystrokes only), but a paste is never cut short
/** Simulates a person typing `text` one character at a time into the box, as the browser reports it. */
const typeInto = (code: string, text: string) => {
  let box = '';
  for (const ch of text) box = formatPhoneInput(code, box + ch, 'insertText');
  return box;
};
assert.equal(typeInto('+91', '9876543210'), '98765 43210');
assert.equal(typeInto('+91', '98765432109999'), '98765 43210'); // extra keystrokes are ignored
assert.equal(typeInto('+91', '09876543210'), '98765 43210'); // leading 0 typed
assert.equal(typeInto('+91', '+91 98765 43210'), '98765 43210'); // country code typed by hand
assert.equal(typeInto('+91', '919876543210'), '98765 43210');
assert.equal(typeInto('+1', '20255501239999'), '(202) 555-0123');
assert.equal(typeInto('+1', '12025550123'), '(202) 555-0123'); // leading 1 typed
assert.equal(nationalDigits('+49', typeInto('+49', '151234567890123')).length, 11); // Germany allows 11
assert.equal(nationalDigits('+81', typeInto('+81', '123456789012345678')).length, 13); // no rule: 15 minus the code
assert.equal(typeInto('+91', 'asd98x76'), '9876'); // letters ignored while typing
assert.equal(maxLocalDigits('+91'), 10); assert.equal(maxLocalDigits('+49'), 11); assert.equal(maxLocalDigits('+81'), 13);
// a paste, a drop and an autofill keep every digit so the mistake is visible and reported, not silently "fixed"
for (const kind of ['insertFromPaste', 'insertFromDrop', 'insertReplacementText', undefined]) {
  const kept = formatPhoneInput('+91', '9876543210999', kind);
  assert.equal(nationalDigits('+91', kept), '9876543210999', String(kind));
  assert.equal(validatePhoneNumber('+91', kept).status, 'invalid');
}
assert.equal(formatPhoneInput('+91', '+91 98765 43210', 'insertFromPaste'), '98765 43210'); // a good paste still works
// deleting never re-caps or changes anything else
assert.equal(formatPhoneInput('+91', '98765 4321', 'deleteContentBackward'), '98765 4321');
// display and country-switch formatting stay uncapped (a stored 11 digit number must never lose a digit)
assert.equal(nationalDigits('+91', formatPhoneNumber('+91', '98765432109')).length, 11);

console.log('countryCodes: all checks passed (' + POPULAR_COUNTRY_CODES.length + ' countries)');
