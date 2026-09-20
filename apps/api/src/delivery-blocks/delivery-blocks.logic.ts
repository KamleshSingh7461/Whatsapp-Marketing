/**
 * "Meta is not delivering to this person": remembered on the contact so broadcasts can leave them alone for a while.
 *
 * Stored on the contact as attributes.metaDelivery = { code, at, until, count, lastWamid }.
 *  - `until` is when the person becomes eligible for broadcasts again.
 *  - Only refusals that are about that person count. Account-wide problems (payment, rate limits) and free-form
 *    messages sent outside the 24-hour window say nothing about the person, so they are ignored here.
 *
 * Keep the browser copy (apps/web/src/lib/metaDelivery.ts) in step with this: it only reads `until`.
 */

export interface MetaDelivery {
  code: string;
  /** When the latest refusal happened (ISO). */
  at: string;
  /** Left alone until this moment (ISO). */
  until: string;
  /** How many refusals in a row, for information. */
  count: number;
  /** The message that was refused; lets a repeated webhook delivery be recognised. */
  lastWamid?: string;
}

/** Days to leave a person alone after each kind of refusal. */
export const REST_DAYS: Record<string, number> = {
  '131049': 14, // Meta held back a marketing message to protect the person's experience
  '130472': 14, // The person is in a Meta test group that receives no marketing
  '131050': 180, // The person chose to stop marketing messages from us
  '131026': 30, // Undeliverable: not on WhatsApp, old app, or terms not accepted
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const isBlockingCode = (code: unknown): boolean =>
  Object.prototype.hasOwnProperty.call(REST_DAYS, String(code));

const read = (raw: unknown): Partial<MetaDelivery> | null =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Partial<MetaDelivery>) : null;

const untilMs = (d: Partial<MetaDelivery> | null): number => {
  const t = d?.until ? Date.parse(d.until) : NaN;
  return Number.isFinite(t) ? t : NaN;
};

/** The block currently in force on a contact's attributes, if any. */
export function activeMetaDelivery(attributes: unknown, now: Date = new Date()): MetaDelivery | null {
  const d = read((attributes as any)?.metaDelivery);
  const t = untilMs(d);
  return d && Number.isFinite(t) && t > now.getTime() ? (d as MetaDelivery) : null;
}

export const isMetaBlocked = (attributes: unknown, now: Date = new Date()): boolean =>
  activeMetaDelivery(attributes, now) !== null;

/**
 * What to store after Meta refuses a message. Returns null when nothing should change: not a person-specific
 * refusal, or the same refusal delivered twice.
 * A longer rest already in force is never shortened by a later, milder refusal.
 */
export function nextMetaDelivery(
  existing: unknown,
  code: unknown,
  wamid: string | undefined,
  now: Date = new Date(),
  restDays: Record<string, number> = REST_DAYS,
): MetaDelivery | null {
  const key = String(code);
  if (!isBlockingCode(key)) return null;

  const before = read(existing);
  if (wamid && before?.lastWamid === wamid) return null;

  const proposedUntil = now.getTime() + (restDays[key] ?? REST_DAYS[key]) * DAY_MS;
  const beforeUntil = untilMs(before);
  const keepBefore = Number.isFinite(beforeUntil) && beforeUntil > proposedUntil;

  return {
    code: keepBefore && before?.code ? String(before.code) : key,
    at: now.toISOString(),
    until: new Date(keepBefore ? beforeUntil : proposedUntil).toISOString(),
    count: (Number(before?.count) || 0) + 1,
    ...(wamid ? { lastWamid: wamid } : {}),
  };
}

/**
 * A message that reached the phone proves the number works, which settles "undeliverable" (131026).
 * It says nothing about Meta's marketing filter, so those rests are left to run out.
 */
export function shouldClearOnDelivery(attributes: unknown): boolean {
  const d = read((attributes as any)?.metaDelivery);
  return d !== null && String(d.code) === '131026';
}
