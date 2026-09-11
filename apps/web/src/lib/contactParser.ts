import { Contact, RFMSegment } from '../types';

export interface ParsedContactResult {
  valid: Contact[];
  invalid: { row: number; name?: string; phone?: string; reason: string }[];
  totalRows: number;
}

/**
 * Normalizes phone numbers into E.164 international format.
 * Cleans prefix markers (like p:, tel:), extra symbols, and adds country code if missing.
 */
export function normalizePhoneNumber(raw: string, defaultCountryCode: string = '91'): string | null {
  if (!raw) return null;

  // Remove common prefixes from Facebook/Instagram Lead Ads like "p:", "p:+", "tel:"
  let cleaned = raw.trim().replace(/^(p:|p:\+|tel:)/i, '');
  
  // Remove all non-digit and non-plus characters
  cleaned = cleaned.replace(/[^0-9+]/g, '');

  if (!cleaned) return null;

  // If already starts with '+', validate length
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (digits.length < 10 || digits.length > 15) return null;
    if (/^(\d)\1{6,}$/.test(digits)) return null; // Reject 0000000, 1111111, etc.
    if (['123456789', '125896', '9119'].includes(digits)) return null;
    return cleaned;
  }

  // Handle numbers without '+'
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) {
    // 10-digit standard Indian mobile number
    return `+${defaultCountryCode}${digits}`;
  } else if (digits.length === 12 && digits.startsWith(defaultCountryCode)) {
    // 12-digit already with 91
    return `+${digits}`;
  } else if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Smart CSV/TSV line parser that respects quoted cells containing commas/newlines.
 */
function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

/**
 * Parses raw CSV, TSV, or tab-delimited text into Contact objects.
 * Automatically identifies Meta/Instagram Lead Ads headers as well as standard CRM headers.
 */
export function parseContactsText(
  rawText: string,
  options?: {
    defaultCohort?: RFMSegment;
    customTags?: string[];
    existingContacts?: Contact[];
  }
): ParsedContactResult {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { valid: [], invalid: [], totalRows: 0 };
  }

  // Auto-detect delimiter: tab vs comma vs semicolon vs pipe
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
  else if (firstLine.includes('|')) delimiter = '|';

  const headers = parseDelimitedLine(firstLine, delimiter).map(h =>
    h.toLowerCase().trim().replace(/[^a-z0-9_]/g, '')
  );

  // Check if first line is a header row
  const hasPhoneHeader = headers.some(h =>
    ['phone', 'phonenumber', 'phone_number', 'mobile', 'contact', 'whatsapp', 'tel', 'cell'].includes(h)
  );
  const hasNameHeader = headers.some(h =>
    ['name', 'fullname', 'full_name', 'first_name', 'firstname', 'lead_name', 'customer'].includes(h)
  );

  const isHeaderPresent = hasPhoneHeader || hasNameHeader;

  let phoneIdx = -1;
  let nameIdx = -1;
  let emailIdx = -1;
  let campaignIdx = -1;
  let platformIdx = -1;
  let adIdx = -1;
  let tagsIdx = -1;
  let cityIdx = -1;

  if (isHeaderPresent) {
    phoneIdx = headers.findIndex(h =>
      ['phone', 'phonenumber', 'phone_number', 'mobile', 'contact', 'whatsapp', 'tel', 'cell'].includes(h)
    );
    nameIdx = headers.findIndex(h =>
      ['name', 'fullname', 'full_name', 'first_name', 'firstname', 'lead_name', 'customer', 'customer_name'].includes(h)
    );
    emailIdx = headers.findIndex(h => ['email', 'email_address', 'mail'].includes(h));
    campaignIdx = headers.findIndex(h => ['campaign_name', 'campaign', 'campaignname'].includes(h));
    platformIdx = headers.findIndex(h => ['platform', 'source', 'lead_source'].includes(h));
    adIdx = headers.findIndex(h => ['ad_name', 'adname', 'adset_name'].includes(h));
    tagsIdx = headers.findIndex(h => ['tags', 'tag', 'cohort', 'audience'].includes(h));
    cityIdx = headers.findIndex(h => ['city', 'location', 'state'].includes(h));
  } else {
    // If no header row, assume col 0 is Name (if text) or Phone (if digits)
    phoneIdx = 0;
    nameIdx = 1;
  }

  const startRow = isHeaderPresent ? 1 : 0;
  const valid: Contact[] = [];
  const invalid: { row: number; name?: string; phone?: string; reason: string }[] = [];
  const existingPhoneSet = new Set(
    (options?.existingContacts || []).map(c => c.phone.replace(/[^0-9]/g, ''))
  );
  const seenBatchPhones = new Set<string>();

  for (let i = startRow; i < lines.length; i++) {
    const rowNum = i + 1;
    const rowData = parseDelimitedLine(lines[i], delimiter);
    if (rowData.length === 0 || rowData.every(c => !c.trim())) continue;

    const rawPhone = phoneIdx >= 0 && phoneIdx < rowData.length ? rowData[phoneIdx] : '';
    const rawName = nameIdx >= 0 && nameIdx < rowData.length ? rowData[nameIdx] : '';
    const rawEmail = emailIdx >= 0 && emailIdx < rowData.length ? rowData[emailIdx] : '';
    const rawCampaign = campaignIdx >= 0 && campaignIdx < rowData.length ? rowData[campaignIdx] : '';
    const rawPlatform = platformIdx >= 0 && platformIdx < rowData.length ? rowData[platformIdx] : '';
    const rawAd = adIdx >= 0 && adIdx < rowData.length ? rowData[adIdx] : '';
    const rawTags = tagsIdx >= 0 && tagsIdx < rowData.length ? rowData[tagsIdx] : '';
    const rawCity = cityIdx >= 0 && cityIdx < rowData.length ? rowData[cityIdx] : '';

    const normalizedPhone = normalizePhoneNumber(rawPhone);

    if (!normalizedPhone) {
      invalid.push({
        row: rowNum,
        name: rawName || 'N/A',
        phone: rawPhone || 'Missing',
        reason: rawPhone ? 'Invalid phone number format or length' : 'Missing phone number',
      });
      continue;
    }

    const cleanDigits = normalizedPhone.replace(/[^0-9]/g, '');

    // Duplicate check within batch
    if (seenBatchPhones.has(cleanDigits)) {
      invalid.push({
        row: rowNum,
        name: rawName,
        phone: normalizedPhone,
        reason: 'Duplicate in uploaded list (skipped)',
      });
      continue;
    }
    seenBatchPhones.add(cleanDigits);

    // Duplicate check against existing CRM
    if (existingPhoneSet.has(cleanDigits)) {
      invalid.push({
        row: rowNum,
        name: rawName,
        phone: normalizedPhone,
        reason: 'Already exists in your CRM contacts',
      });
      continue;
    }

    // Build tags
    const tagsSet = new Set<string>();
    if (options?.customTags) {
      options.customTags.forEach(t => t.trim() && tagsSet.add(t.trim()));
    }
    if (rawPlatform) {
      if (rawPlatform.toLowerCase() === 'ig') tagsSet.add('Instagram Lead');
      else if (rawPlatform.toLowerCase() === 'fb') tagsSet.add('Facebook Lead');
      else tagsSet.add(rawPlatform.toUpperCase());
    } else {
      tagsSet.add('Bulk Upload');
    }

    if (rawCampaign) {
      const cleanCamp = rawCampaign.replace(/^New Leads campaign\s+/i, '').trim();
      if (cleanCamp) tagsSet.add(cleanCamp);
    }
    if (rawTags) {
      rawTags.split(',').forEach(t => t.trim() && tagsSet.add(t.trim()));
    }

    const contact: Contact = {
      id: `cnt_bulk_${Date.now()}_${i}`,
      displayName: rawName.trim() || `Lead ${normalizedPhone}`,
      phone: normalizedPhone,
      email: rawEmail.trim() || undefined,
      optedIn: true,
      optedInAt: new Date().toISOString(),
      optInSource: rawPlatform ? 'CLICK_TO_WHATSAPP_AD' : 'ORGANIC_INBOUND',
      rfmSegment: options?.defaultCohort || 'NEW_LEADS',
      tags: Array.from(tagsSet),
      attributes: {
        ...(rawEmail ? { email: rawEmail.trim() } : {}),
        ...(rawPlatform ? { platform: rawPlatform } : {}),
        ...(rawCampaign ? { campaign: rawCampaign } : {}),
        ...(rawAd ? { ad: rawAd } : {}),
        ...(rawCity ? { city: rawCity } : {}),
        importedAt: new Date().toISOString(),
      },
      lifetimeValue: 0,
      totalOrders: 0,
      lastActiveAt: new Date().toISOString(),
    };

    valid.push(contact);
  }

  return {
    valid,
    invalid,
    totalRows: lines.length - startRow,
  };
}
