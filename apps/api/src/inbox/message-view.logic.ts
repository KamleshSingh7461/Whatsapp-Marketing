// Pure helpers for how a chat message is shown and changed: attachments, who sent it, and the edit rules.
// No database or network here, so they can be checked with: npx tsx src/inbox/message-view.logic.check.ts

export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'sticker';

export interface MessageMedia {
  mediaId?: string;
  mediaUrl?: string;
  mediaType?: MediaKind;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  caption?: string;
}

const MEDIA_KINDS: MediaKind[] = ['image', 'video', 'audio', 'document', 'sticker'];

export const mediaProxyUrl = (mediaId: string) => `/api/whatsapp/media/${encodeURIComponent(mediaId)}`;

/** The attachment inside a message Meta delivered to our webhook, if it has one. */
export function inboundMediaOf(message: any): MessageMedia | null {
  const kind = MEDIA_KINDS.find(k => message?.type === k || (message?.[k] && typeof message[k] === 'object'));
  if (!kind) return null;
  const part = message[kind] || {};
  return {
    mediaId: part.id,
    mediaUrl: part.id ? mediaProxyUrl(part.id) : undefined,
    mediaType: kind,
    mimeType: part.mime_type,
    fileName: part.filename,
    caption: part.caption,
  };
}

/** Text to show for an inbound message that has no text of its own. */
export function inboundFallbackText(message: any): string {
  const media = inboundMediaOf(message);
  if (media) {
    if (media.mediaType === 'audio') return message.audio?.voice ? 'Voice message' : 'Audio';
    if (media.mediaType === 'document') return media.fileName || 'Document';
    return media.mediaType === 'image' ? 'Photo' : media.mediaType === 'video' ? 'Video' : 'Sticker';
  }
  if (message?.type === 'location' && message.location) {
    const { latitude, longitude, name, address } = message.location;
    const label = [name, address].filter(Boolean).join(', ');
    return `📍 ${label ? label + ' ' : ''}https://maps.google.com/?q=${latitude},${longitude}`;
  }
  if (message?.type === 'contacts' && Array.isArray(message.contacts)) {
    return message.contacts
      .map((c: any) => `👤 ${c.name?.formatted_name || 'Contact'}${c.phones?.[0]?.phone ? ' ' + c.phones[0].phone : ''}`)
      .join('\n');
  }
  if (message?.type === 'reaction') return message.reaction?.emoji ? `Reacted ${message.reaction.emoji}` : 'Removed a reaction';
  return message?.type ? `[${String(message.type).toUpperCase()} Message]` : 'Inbound WhatsApp message';
}

/**
 * The attachment of a stored message, for display. Older inbound messages were saved before documents, audio and
 * video were understood, but the original Meta message is kept in payload.raw, so it is read from there.
 */
export function storedMediaOf(payload: any): MessageMedia {
  const p = payload || {};
  const fromRaw = p.raw ? inboundMediaOf(p.raw) : null;
  const mediaId = p.mediaId || fromRaw?.mediaId || p.image?.id;
  const mediaUrl =
    (p.mediaUrl && !String(p.mediaUrl).startsWith('data:') ? p.mediaUrl : undefined) ||
    (mediaId ? mediaProxyUrl(mediaId) : undefined) ||
    p.imageUrl ||
    p.image?.link;
  const mediaType: MediaKind | undefined = p.mediaType || fromRaw?.mediaType || (mediaUrl ? 'image' : undefined);
  return {
    mediaId,
    mediaUrl,
    mediaType,
    mimeType: p.mimeType || fromRaw?.mimeType,
    fileName: p.fileName || fromRaw?.fileName,
    fileSize: typeof p.fileSize === 'number' ? p.fileSize : undefined,
    caption: p.caption ?? fromRaw?.caption,
  };
}

/** How Meta should receive a file we send, from its type. Meta takes only JPEG and PNG as photos. */
export function outboundKindForMime(mime: string): Exclude<MediaKind, 'sticker'> {
  const m = (mime || '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/png') return 'image';
  if (m === 'video/mp4' || m === 'video/3gpp') return 'video';
  if (['audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg'].includes(m)) return 'audio';
  return 'document';
}

/** Meta's size limits per kind (document is kept lower than Meta's 100 MB so uploads stay quick). */
export const MAX_MEDIA_BYTES: Record<Exclude<MediaKind, 'sticker'>, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 25 * 1024 * 1024,
};

/** Reads a browser data: URL into bytes. Returns null when it is not one. */
export function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const match = /^data:([^;,]+)?(;[^,]*)?,(.*)$/s.exec(dataUrl || '');
  if (!match) return null;
  const isBase64 = (match[2] || '').includes(';base64');
  const bytes = isBase64 ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
  return { mime: (match[1] || 'application/octet-stream').toLowerCase(), bytes };
}

export function roleLabel(role?: string | null, isSuperAdmin?: boolean | null): string | undefined {
  if (isSuperAdmin) return 'Super Admin';
  switch (role) {
    case 'ADMIN': return 'Admin';
    case 'AGENT': return 'Agent';
    case 'MARKETER': return 'Marketer';
    case 'VIEWER': return 'Viewer';
    default: return undefined;
  }
}

// ---- Editing. WhatsApp (Meta) offers businesses no way to change a message already on the customer's phone, so an
// edit updates our copy and, for a message the customer received, sends the new text as one ordinary reply.

export const EDIT_WINDOW_MINUTES = 15;

export const correctionText = (text: string) => `✏️ Correction: ${text}`;

export interface EditCheckInput {
  direction: 'INBOUND' | 'OUTBOUND';
  isInternalNote: boolean;
  isTemplate: boolean;
  hasMedia: boolean;
  status: string;
  sentAt: Date;
  windowExpiresAt: Date | null;
  authorId?: string | null;
  editorId: string;
  editorIsAdmin: boolean;
  now: Date;
}

export type EditDecision =
  | { ok: true; sendToCustomer: boolean }
  | { ok: false; reason: string };

export function decideEdit(i: EditCheckInput): EditDecision {
  if (i.direction !== 'OUTBOUND') return { ok: false, reason: 'Only messages your team sent can be edited.' };
  const isOwn = !!i.authorId && i.authorId === i.editorId;
  if (!isOwn && !i.editorIsAdmin) return { ok: false, reason: 'Only the person who sent it, or an admin, can edit this message.' };
  if (i.isInternalNote) return { ok: true, sendToCustomer: false };
  if (i.isTemplate) return { ok: false, reason: 'Template messages cannot be edited.' };
  if (i.hasMedia) return { ok: false, reason: 'Attachments cannot be edited. Send a new message instead.' };
  if (i.status === 'FAILED') return { ok: false, reason: 'This message was not delivered, so there is nothing to correct.' };
  if (i.now.getTime() - i.sentAt.getTime() > EDIT_WINDOW_MINUTES * 60_000) {
    return { ok: false, reason: `Messages can only be edited within ${EDIT_WINDOW_MINUTES} minutes of sending.` };
  }
  if (!i.windowExpiresAt || i.windowExpiresAt.getTime() <= i.now.getTime()) {
    return { ok: false, reason: "The customer's 24-hour reply window has closed, so a correction cannot be sent." };
  }
  return { ok: true, sendToCustomer: true };
}
