import type { Contact } from '../types';

/**
 * "Meta is not delivering to this person". The server records it on the contact when Meta refuses a message
 * (attributes.metaDelivery = { code, at, until, count }); broadcasts leave the person alone until `until`.
 * The rules that decide `until` live on the server (apps/api/src/delivery-blocks). This file only reads the result.
 */

export interface MetaBlock {
  code: string;
  /** Left alone until this moment. */
  until: Date;
  /** Refusals in a row. */
  count: number;
}

const REASON: Record<string, string> = {
  '131049': 'Meta held back marketing messages to this person',
  '130472': 'This person is in a Meta test group that gets no marketing',
  '131050': 'This person chose to stop marketing messages',
  '131026': 'This number cannot receive WhatsApp messages',
};

/** The block in force for a contact right now, or null. Malformed data never blocks anyone. */
export function metaBlockOf(contact: Pick<Contact, 'attributes'>, now: number = Date.now()): MetaBlock | null {
  const d = contact.attributes?.metaDelivery;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const until = Date.parse(String((d as any).until));
  if (!Number.isFinite(until) || until <= now) return null;
  return { code: String((d as any).code ?? ''), until: new Date(until), count: Number((d as any).count) || 1 };
}

export const isMetaBlocked = (contact: Pick<Contact, 'attributes'>, now: number = Date.now()): boolean =>
  metaBlockOf(contact, now) !== null;

export const metaBlockReason = (b: MetaBlock): string => REASON[b.code] ?? 'Meta recently refused to deliver to this person';

/** e.g. "4 Oct" */
export const formatBlockUntil = (b: MetaBlock): string =>
  b.until.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
