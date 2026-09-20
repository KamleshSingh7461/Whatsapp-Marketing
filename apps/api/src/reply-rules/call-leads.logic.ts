/**
 * The call sheet: rules for updating a lead's call status, and the summary managers use to oversee the team.
 * Plain functions with no database, so they can be tested directly.
 */

export const CALL_STATUSES = ['CALL_PENDING', 'CALLED_NOT_PICKED', 'CALL_DONE', 'FOLLOW_UP_PENDING'] as const;
export type CallStatusValue = (typeof CALL_STATUSES)[number];

export const CALL_STATUS_LABELS: Record<CallStatusValue, string> = {
  CALL_PENDING: 'Call pending',
  CALLED_NOT_PICKED: 'Called, not picked',
  CALL_DONE: 'Call done',
  FOLLOW_UP_PENDING: 'Follow up pending',
};

export const REMARK_MAX = 500;

export const isCallStatus = (v: unknown): v is CallStatusValue =>
  typeof v === 'string' && (CALL_STATUSES as readonly string[]).includes(v);

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export interface CallUpdateInput {
  status: CallStatusValue;
  remarks: string | null;
}

/**
 * Checks an update from the call sheet. A status and an optional remark; a blank remark is stored as null.
 * Saving the same status again with no remark is refused, because it would add a meaningless entry to the log
 * that managers read.
 */
export function validateCallUpdate(
  input: any,
  current: { callStatus: CallStatusValue; remarks: string | null },
): Validation<CallUpdateInput> {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Nothing was sent.' };
  if (!isCallStatus(input.status)) return { ok: false, error: 'Choose a call status.' };

  const remarks = typeof input.remarks === 'string' ? input.remarks.replace(/\s+/g, ' ').trim() : '';
  if (remarks.length > REMARK_MAX) return { ok: false, error: `Remarks can be at most ${REMARK_MAX} characters.` };

  if (input.status === current.callStatus && remarks === '') {
    return { ok: false, error: 'Nothing has changed. Choose a different status or add a remark.' };
  }
  return { ok: true, value: { status: input.status, remarks: remarks === '' ? null : remarks } };
}

/** 1 = last 24 hours, 7 and 30 days. Anything else falls back to 7. */
export function clampOverviewDays(input: unknown): 1 | 7 | 30 {
  const d = Math.floor(Number(input));
  return d === 1 || d === 30 ? d : 7;
}

export interface UpdateRow {
  byUserId: string;
  byName: string;
  byRole: string;
  status: CallStatusValue;
  leadId: string;
  createdAt: Date;
}

export interface PersonActivity {
  userId: string;
  name: string;
  role: string;
  updates: number;
  leadsTouched: number;
  byStatus: Record<CallStatusValue, number>;
  lastActiveAt: Date;
}

const zeroCounts = (): Record<CallStatusValue, number> => ({
  CALL_PENDING: 0,
  CALLED_NOT_PICKED: 0,
  CALL_DONE: 0,
  FOLLOW_UP_PENDING: 0,
});

/**
 * One line per team member: how many updates they made, on how many different leads, what they set, and when they
 * were last active. The newest name and role seen for a person are used. Busiest first.
 */
export function aggregatePeople(rows: UpdateRow[]): PersonActivity[] {
  const people = new Map<string, PersonActivity & { leadIds: Set<string> }>();
  for (const r of rows) {
    let p = people.get(r.byUserId);
    if (!p) {
      p = { userId: r.byUserId, name: r.byName, role: r.byRole, updates: 0, leadsTouched: 0, byStatus: zeroCounts(), lastActiveAt: r.createdAt, leadIds: new Set() };
      people.set(r.byUserId, p);
    }
    p.updates += 1;
    p.byStatus[r.status] += 1;
    p.leadIds.add(r.leadId);
    if (r.createdAt.getTime() >= p.lastActiveAt.getTime()) {
      p.lastActiveAt = r.createdAt;
      p.name = r.byName;
      p.role = r.byRole;
    }
  }
  return [...people.values()]
    .map(({ leadIds, ...p }) => ({ ...p, leadsTouched: leadIds.size }))
    .sort((a, b) => b.updates - a.updates || b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
}

/** Counts per status for a set of leads, always with all four keys so screens never handle a missing one. */
export function countByStatus(statuses: Array<{ status: CallStatusValue; count: number }>): Record<CallStatusValue, number> {
  const out = zeroCounts();
  for (const s of statuses) out[s.status] += s.count;
  return out;
}
