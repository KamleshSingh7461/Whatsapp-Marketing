// The per-number broadcast report: what each status means, the filters, Meta's error codes in plain words, and the
// CSV columns. Checked by scripts/broadcastReport.check.ts.

export type RecipientStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'CANCELLED';

export interface RecipientRow {
  id: string;
  phone: string;
  displayName?: string | null;
  status: RecipientStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  attempts?: number;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
}

export const STATUS_LABEL: Record<RecipientStatus, string> = {
  QUEUED: 'Waiting to send',
  SENDING: 'Sending',
  SENT: 'Sent, not delivered yet',
  DELIVERED: 'Delivered',
  READ: 'Read',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export const STATUS_TONE: Record<RecipientStatus, 'ok' | 'good' | 'wait' | 'bad' | 'off'> = {
  QUEUED: 'wait',
  SENDING: 'wait',
  SENT: 'wait',
  DELIVERED: 'ok',
  READ: 'good',
  FAILED: 'bad',
  CANCELLED: 'off',
};

/** The report's filter tabs, and which stored statuses each one shows. */
export const REPORT_FILTERS: Array<{ key: string; label: string; statuses: RecipientStatus[] }> = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'not-delivered', label: 'Not delivered', statuses: ['QUEUED', 'SENDING', 'SENT', 'FAILED'] },
  { key: 'failed', label: 'Failed', statuses: ['FAILED'] },
  { key: 'delivered', label: 'Delivered', statuses: ['DELIVERED', 'READ'] },
  { key: 'read', label: 'Read', statuses: ['READ'] },
];

/** How many numbers a filter shows, from the campaign's status counts. */
export function filterCount(statuses: RecipientStatus[], counts: Partial<Record<RecipientStatus, number>>): number {
  const keys = statuses.length > 0 ? statuses : (Object.keys(STATUS_LABEL) as RecipientStatus[]);
  return keys.reduce((n, k) => n + (counts[k] || 0), 0);
}

// Meta's common delivery error codes, in plain words.
const META_ERRORS: Record<string, string> = {
  '131026': 'Number cannot receive this message (not on WhatsApp, or an old WhatsApp version)',
  '131049': 'Meta held back this marketing message to protect the person from too many',
  '131050': 'This person stopped marketing messages from your business',
  '130472': 'This person is in a Meta test group that gets no marketing messages',
  '131047': "More than 24 hours since the person's last message; only templates can be sent",
  '131048': 'Too many messages were marked as spam; Meta limited sending',
  '131056': 'Too many messages to this person in a short time',
  '131042': 'Payment problem on the WhatsApp Business account',
  '131051': 'Message type not supported',
  '131000': 'Meta could not send the message (temporary error)',
  '132000': 'Template variables did not match the approved template',
  '132001': 'Template not found in this language',
  '132015': 'Template is paused by Meta for low quality',
  '132016': 'Template is disabled by Meta',
  '130429': 'Sending too fast for Meta; slowed down',
  '131030': 'Number not in the allowed test list (Meta app in development mode)',
  INTERRUPTED: 'The server stopped while sending; it may or may not have arrived',
};

export function failureReason(code?: string | null, message?: string | null): string {
  const known = code ? META_ERRORS[String(code)] : undefined;
  if (known) return known;
  const text = (message || '').trim();
  if (text) return code && code !== 'SEND_FAILED' ? `${text} (code ${code})` : text;
  return code ? `Failed (code ${code})` : 'Failed';
}

const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export const REPORT_CSV_HEADER = ['Name', 'WhatsApp number', 'Status', 'Sent at', 'Delivered at', 'Read at', 'Reason', 'Error code'];

export function reportCsvRow(r: RecipientRow): string[] {
  return [
    r.displayName && !r.displayName.startsWith('+') ? r.displayName : '',
    `+${r.phone}`,
    STATUS_LABEL[r.status] || r.status,
    fmtTime(r.sentAt),
    fmtTime(r.deliveredAt),
    fmtTime(r.readAt),
    r.status === 'FAILED' ? failureReason(r.errorCode, r.errorMessage) : '',
    r.errorCode || '',
  ];
}
