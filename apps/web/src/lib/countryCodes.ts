export interface CountryCodeItem {
  code: string;
  name: string;
  flag: string;
  sampleDigits: string;
}

export const POPULAR_COUNTRY_CODES: CountryCodeItem[] = [
  { code: '+91', name: 'India', flag: '🇮🇳', sampleDigits: '98765 43210' },
  { code: '+1', name: 'United States / Canada', flag: '🇺🇸', sampleDigits: '202 555 0123' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧', sampleDigits: '7911 123456' },
  { code: '+971', name: 'United Arab Emirates', flag: '🇦🇪', sampleDigits: '50 123 4567' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦', sampleDigits: '50 123 4567' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬', sampleDigits: '8123 4567' },
  { code: '+61', name: 'Australia', flag: '🇦🇺', sampleDigits: '412 345 678' },
  { code: '+49', name: 'Germany', flag: '🇩🇪', sampleDigits: '151 23456789' },
  { code: '+33', name: 'France', flag: '🇫🇷', sampleDigits: '6 12 34 56 78' },
  { code: '+34', name: 'Spain', flag: '🇪🇸', sampleDigits: '612 34 56 78' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰', sampleDigits: '300 1234567' },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩', sampleDigits: '1712 345678' },
  { code: '+977', name: 'Nepal', flag: '🇳🇵', sampleDigits: '984 1234567' },
  { code: '+94', name: 'Sri Lanka', flag: '🇱🇰', sampleDigits: '71 234 5678' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦', sampleDigits: '82 123 4567' },
  { code: '+234', name: 'Nigeria', flag: '🇳🇬', sampleDigits: '802 123 4567' },
  { code: '+254', name: 'Kenya', flag: '🇰🇪', sampleDigits: '712 345678' },
];

/**
 * How a mobile number is written in each supported country, in digits and WITHOUT the country code.
 *  - `lengths`: the digit counts a mobile number can have
 *  - `first`: the digits a mobile number can start with (omit when any digit is fine)
 *  - `trunkZero`: people there write a leading 0 when dialling locally (09876 543210), which is not part of the
 *    international number and must be dropped, or the number ends up wrong
 *  - `label`: how the number is described to the user
 * Numbers for WhatsApp are mobiles, so these are the mobile numbering plans.
 */
interface CountryRule {
  lengths: number[];
  first?: string;
  trunkZero?: boolean;
  label: string;
  hint?: string;
  /** Extra check on the national digits; returns a message when the number is not valid. */
  extra?: (national: string) => string | null;
}

const COUNTRY_RULES: Record<string, CountryRule> = {
  '+91': { lengths: [10], first: '6789', trunkZero: true, label: 'Indian mobile', hint: 'Indian mobile numbers start with 6, 7, 8 or 9' },
  // North America: area code and exchange both start with 2 to 9.
  '+1': {
    lengths: [10], first: '23456789', label: 'US/Canada phone', hint: 'A US or Canadian area code starts with 2 to 9',
    extra: n => (n.length >= 4 && !'23456789'.includes(n[3]) ? 'The 4th digit of a US or Canadian number starts with 2 to 9' : null),
  },
  '+44': { lengths: [10], first: '7', trunkZero: true, label: 'UK mobile', hint: 'UK mobile numbers start with 7' },
  '+971': { lengths: [9], first: '5', trunkZero: true, label: 'UAE mobile', hint: 'UAE mobile numbers start with 5' },
  '+966': { lengths: [9], first: '5', trunkZero: true, label: 'Saudi mobile', hint: 'Saudi mobile numbers start with 5' },
  '+65': { lengths: [8], first: '89', label: 'Singapore mobile', hint: 'Singapore mobile numbers start with 8 or 9' },
  '+61': { lengths: [9], first: '4', trunkZero: true, label: 'Australian mobile', hint: 'Australian mobile numbers start with 4' },
  '+49': { lengths: [10, 11], first: '1', trunkZero: true, label: 'German mobile', hint: 'German mobile numbers start with 1 (015x, 016x, 017x)' },
  '+33': { lengths: [9], first: '67', trunkZero: true, label: 'French mobile', hint: 'French mobile numbers start with 6 or 7' },
  '+34': { lengths: [9], first: '67', label: 'Spanish mobile', hint: 'Spanish mobile numbers start with 6 or 7' },
  '+92': { lengths: [10], first: '3', trunkZero: true, label: 'Pakistani mobile', hint: 'Pakistani mobile numbers start with 3' },
  '+880': { lengths: [10], first: '1', trunkZero: true, label: 'Bangladeshi mobile', hint: 'Bangladeshi mobile numbers start with 1' },
  '+977': { lengths: [10], first: '9', label: 'Nepali mobile', hint: 'Nepali mobile numbers start with 9' },
  '+94': { lengths: [9], first: '7', trunkZero: true, label: 'Sri Lankan mobile', hint: 'Sri Lankan mobile numbers start with 7' },
  '+27': { lengths: [9], first: '678', trunkZero: true, label: 'South African mobile', hint: 'South African mobile numbers start with 6, 7 or 8' },
  '+234': { lengths: [10], first: '789', trunkZero: true, label: 'Nigerian mobile', hint: 'Nigerian mobile numbers start with 7, 8 or 9' },
  '+254': { lengths: [9], first: '17', trunkZero: true, label: 'Kenyan mobile', hint: 'Kenyan mobile numbers start with 7 or 1' },
};

/** International numbers are at most 15 digits including the country code (E.164). */
const E164_MAX_TOTAL = 15;
const E164_MIN_NATIONAL = 7;

const maxNational = (countryCode: string): number | undefined => {
  const rule = COUNTRY_RULES[countryCode];
  return rule ? Math.max(...rule.lengths) : undefined;
};

/**
 * True when `digits` already starts with the country code, i.e. the user typed or pasted the full
 * international number. A number that merely BEGINS with the same digits as the country code is a
 * local number: 9123456789 is a valid 10-digit Indian mobile, not "+91" followed by 23456789. So the
 * leading digits count as a prefix only when the number is longer than the country's national length.
 */
function hasCountryPrefix(digits: string, countryCode: string): boolean {
  const cleanCode = countryCode.replace(/[^\d]/g, '');
  if (!digits.startsWith(cleanCode)) return false;
  const max = maxNational(countryCode);
  return max !== undefined ? digits.length > max : digits.length > cleanCode.length + 5;
}

/**
 * Whatever was typed or pasted, reduced to the national digits: letters and punctuation removed, the country
 * code dropped if it was included, and the local leading 0 dropped in countries that use one.
 * "098765 43210", "+91 98765 43210" and "9876543210" all become "9876543210" for India.
 */
export function nationalDigits(countryCode: string, input: string): string {
  let digits = input.replace(/[^\d]/g, '');
  if (!digits) return '';
  const cleanCode = countryCode.replace(/[^\d]/g, '');
  if (hasCountryPrefix(digits, countryCode)) digits = digits.slice(cleanCode.length);
  if (COUNTRY_RULES[countryCode]?.trunkZero && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/**
 * Combines country code prefix and raw phone string into a clean digit string
 * e.g. cleanPhoneWithCountry('+91', '9876543210') => '919876543210'
 */
export function cleanPhoneWithCountry(countryCode: string, rawPhone: string): string {
  const national = nationalDigits(countryCode, rawPhone);
  if (!national) return '';
  return `${countryCode.replace(/[^\d]/g, '')}${national}`;
}

/**
 * Compares two phone strings to see if they belong to the same person
 */
export function isSamePhoneNumber(phoneA?: string | null, phoneB?: string | null): boolean {
  if (!phoneA || !phoneB) return false;
  const digitsA = phoneA.replace(/[^\d]/g, '');
  const digitsB = phoneB.replace(/[^\d]/g, '');
  if (!digitsA || !digitsB) return false;

  if (digitsA === digitsB) return true;

  // If last 10 digits match (standard national mobile number length)
  if (digitsA.length >= 10 && digitsB.length >= 10) {
    return digitsA.slice(-10) === digitsB.slice(-10);
  }

  return false;
}

/**
 * Strips everything but digits and groups them the way that country writes numbers. It never cuts digits off:
 * a number that is too long stays visible so validatePhoneNumber can say so, rather than silently changing it.
 */
export function formatPhoneNumber(countryCode: string, input: string): string {
  return groupDigits(countryCode, nationalDigits(countryCode, input).slice(0, E164_MAX_TOTAL));
}

/** The most digits a number can have in that country, without the country code. */
export function maxLocalDigits(countryCode: string): number {
  return maxNational(countryCode) ?? E164_MAX_TOTAL - countryCode.replace(/[^\d]/g, '').length;
}

/**
 * For a text box where a person types a phone number. Typing stops at a full number: once the country's digit
 * count is reached, more keystrokes are ignored. Only real keystrokes (`inputType` "insertText") are limited.
 * A paste, a drop or a browser autofill is never cut short, because silently dropping the end of a pasted number
 * would change it into a different person's number; a too-long paste stays visible and validatePhoneNumber
 * reports it.
 */
export function formatPhoneInput(countryCode: string, raw: string, inputType?: string): string {
  const national = nationalDigits(countryCode, raw);
  const limit = inputType === 'insertText' ? maxLocalDigits(countryCode) : E164_MAX_TOTAL;
  return groupDigits(countryCode, national.slice(0, limit));
}

function groupDigits(countryCode: string, local: string): string {
  if (!local) return '';

  if (countryCode === '+91') {
    if (local.length <= 5) return local;
    return `${local.slice(0, 5)} ${local.slice(5)}`;
  }

  if (countryCode === '+1') {
    if (local.length <= 3) return local;
    if (local.length <= 6) return `(${local.slice(0, 3)}) ${local.slice(3)}`;
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }

  if (countryCode === '+44') {
    if (local.length <= 4) return local;
    return `${local.slice(0, 4)} ${local.slice(4)}`;
  }

  if (countryCode === '+971' || countryCode === '+966') {
    if (local.length <= 2) return local;
    if (local.length <= 5) return `${local.slice(0, 2)} ${local.slice(2)}`;
    return `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
  }

  return local.replace(/(\d{3,4})(?=\d)/g, '$1 ');
}

const plural = (n: number) => `${n} more digit${n === 1 ? '' : 's'}`;
// "An Indian", but "A UK", "A US", "A UAE" (pronounced with a leading "you").
const aOrAn = (label: string) => (/^(UK|US|UAE) /.test(label) ? 'A' : /^[aeiou]/i.test(label) ? 'An' : 'A');

/**
 * Validates whether the typed digits are a real mobile number for the selected country. The message is
 * written for the person typing, so it says what to fix.
 */
export function validatePhoneNumber(countryCode: string, input: string): {
  isValid: boolean;
  /** 'incomplete' = still being typed, nothing wrong yet; 'invalid' = something is wrong. */
  status: 'valid' | 'incomplete' | 'invalid';
  message: string;
  requiredDigits: number;
  currentDigits: number;
} {
  const national = nationalDigits(countryCode, input);
  const currentDigits = national.length;
  const rule = COUNTRY_RULES[countryCode];

  if (!rule) {
    // A country without its own rule: only the international standard applies.
    const cleanCode = countryCode.replace(/[^\d]/g, '');
    const requiredDigits = E164_MAX_TOTAL - cleanCode.length;
    if (currentDigits === 0) return { isValid: false, status: 'incomplete', message: 'Enter the phone number', requiredDigits, currentDigits };
    if (currentDigits < E164_MIN_NATIONAL) {
      return { isValid: false, status: 'incomplete', message: `${plural(E164_MIN_NATIONAL - currentDigits)} needed`, requiredDigits, currentDigits };
    }
    if (cleanCode.length + currentDigits > E164_MAX_TOTAL) {
      return { isValid: false, status: 'invalid', message: `Too long. With the country code a number has at most ${E164_MAX_TOTAL} digits`, requiredDigits, currentDigits };
    }
    return { isValid: true, status: 'valid', message: '✓ Valid international number', requiredDigits, currentDigits };
  }

  const shortest = Math.min(...rule.lengths);
  const longest = Math.max(...rule.lengths);
  const requiredDigits = longest;
  const lengthText = rule.lengths.length > 1 ? `${shortest} or ${longest}` : `${longest}`;

  if (currentDigits === 0) {
    return { isValid: false, status: 'incomplete', message: `Enter the ${lengthText}-digit mobile number`, requiredDigits, currentDigits };
  }
  // Wrong starting digit is reported straight away, before the person has typed the whole number.
  if (rule.first && !rule.first.includes(national[0])) {
    return { isValid: false, status: 'invalid', message: rule.hint || `Not ${aOrAn(rule.label).toLowerCase()} ${rule.label} number`, requiredDigits, currentDigits };
  }
  const extra = rule.extra?.(national);
  if (extra) return { isValid: false, status: 'invalid', message: extra, requiredDigits, currentDigits };

  if (currentDigits > longest) {
    return { isValid: false, status: 'invalid', message: `Too long. ${aOrAn(rule.label)} ${rule.label} number has ${lengthText} digits`, requiredDigits, currentDigits };
  }
  if (currentDigits < shortest) {
    return { isValid: false, status: 'incomplete', message: `${plural(shortest - currentDigits)} needed (${lengthText} digits)`, requiredDigits, currentDigits };
  }
  if (!rule.lengths.includes(currentDigits)) {
    return { isValid: false, status: 'invalid', message: `${aOrAn(rule.label)} ${rule.label} number has ${lengthText} digits`, requiredDigits, currentDigits };
  }
  return { isValid: true, status: 'valid', message: `✓ Valid ${rule.label} number`, requiredDigits, currentDigits };
}
