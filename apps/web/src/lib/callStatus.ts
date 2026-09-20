import { CallLeadRow, CallStatus } from '../types';

/** Work that still needs doing comes first. */
export const CALL_STATUS_ORDER: CallStatus[] = ['CALL_PENDING', 'FOLLOW_UP_PENDING', 'CALLED_NOT_PICKED', 'CALL_DONE'];

export const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  CALL_PENDING: 'Call pending',
  FOLLOW_UP_PENDING: 'Follow up pending',
  CALLED_NOT_PICKED: 'Called, not picked',
  CALL_DONE: 'Call done',
};

export const CALL_STATUS_HINT: Record<CallStatus, string> = {
  CALL_PENDING: 'Not called yet',
  FOLLOW_UP_PENDING: 'Spoke to them, and a follow-up is due',
  CALLED_NOT_PICKED: 'Called, but they did not pick up',
  CALL_DONE: 'Spoke to them and the call is complete',
};

/** Colour of the status pill (the tones defined for .wa-bc-status). */
export const CALL_STATUS_TONE: Record<CallStatus, 'live' | 'admin' | 'fail' | 'done'> = {
  CALL_PENDING: 'live',
  FOLLOW_UP_PENDING: 'admin',
  CALLED_NOT_PICKED: 'fail',
  CALL_DONE: 'done',
};

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  MARKETER: 'Marketer',
  AGENT: 'Support agent',
  VIEWER: 'Viewer',
};

const PRIORITY: Record<CallStatus, number> = { CALL_PENDING: 0, FOLLOW_UP_PENDING: 1, CALLED_NOT_PICKED: 2, CALL_DONE: 3 };

/**
 * The order to work the list in: things still to do first (people waiting longest at the top), finished calls last
 * (most recent first).
 */
export function sortCallLeads(rows: CallLeadRow[]): CallLeadRow[] {
  return [...rows].sort((a, b) => {
    if (PRIORITY[a.status] !== PRIORITY[b.status]) return PRIORITY[a.status] - PRIORITY[b.status];
    if (a.status === 'CALL_DONE') {
      return new Date(b.updatedAt || b.lastTapAt).getTime() - new Date(a.updatedAt || a.lastTapAt).getTime();
    }
    return new Date(a.firstTapAt).getTime() - new Date(b.firstTapAt).getTime();
  });
}

/** True when the customer tapped again after the team last updated them: worth a second look. */
export function tappedAgain(row: CallLeadRow): boolean {
  return (
    row.tapCount > 1 &&
    !!row.updatedAt &&
    new Date(row.lastTapAt).getTime() > new Date(row.updatedAt).getTime()
  );
}

export const personName = (c: { displayName: string | null; phone: string }) =>
  c.displayName && !c.displayName.startsWith('+') ? c.displayName : `+${c.phone.replace(/^\+/, '')}`;

export const countByStatus = (rows: CallLeadRow[]): Record<CallStatus, number> => {
  const out: Record<CallStatus, number> = { CALL_PENDING: 0, FOLLOW_UP_PENDING: 0, CALLED_NOT_PICKED: 0, CALL_DONE: 0 };
  for (const r of rows) out[r.status] += 1;
  return out;
};
