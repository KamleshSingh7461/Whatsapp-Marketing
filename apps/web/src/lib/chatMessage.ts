// Attachments, sender labels and edit rules for messages in Chats.
// The server checks the same edit rules (apps/api/src/inbox/message-view.logic.ts); this copy only decides
// whether to offer the Edit button. Checked by scripts/chatMessage.check.ts.
import type { Message, User } from '../types';

export interface ChatAttachment {
  dataUrl: string;
  fileName: string;
  mime: string;
  size: number;
}

export type OutboundKind = 'image' | 'video' | 'audio' | 'document';

/** How WhatsApp receives a file of this type. Only JPEG and PNG go as photos; other images go as documents. */
export function outboundKindForMime(mime: string): OutboundKind {
  const m = (mime || '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/png') return 'image';
  if (m === 'video/mp4' || m === 'video/3gpp') return 'video';
  if (['audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg'].includes(m)) return 'audio';
  return 'document';
}

const MB = 1024 * 1024;
export const MAX_ATTACHMENT_BYTES: Record<OutboundKind, number> = {
  image: 5 * MB,
  video: 16 * MB,
  audio: 16 * MB,
  document: 25 * MB,
};

/** Null when the file can be sent, otherwise the reason it cannot. */
export function attachmentProblem(file: { type: string; size: number }): string | null {
  const kind = outboundKindForMime(file.type);
  if (file.size > MAX_ATTACHMENT_BYTES[kind]) {
    return `This file is too large. WhatsApp allows ${kind === 'image' ? 'photos' : kind === 'document' ? 'documents' : kind + ' files'} up to ${MAX_ATTACHMENT_BYTES[kind] / MB} MB.`;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${bytes} B`;
}

export function roleLabelOf(user?: Pick<User, 'role' | 'isSuperAdmin'> | null): string | undefined {
  if (!user) return undefined;
  if (user.isSuperAdmin) return 'Super Admin';
  switch (user.role) {
    case 'ADMIN': return 'Admin';
    case 'AGENT': return 'Agent';
    case 'MARKETER': return 'Marketer';
    case 'VIEWER': return 'Viewer';
    default: return undefined;
  }
}

/** "Priya · Agent", or just the name when the role is not known. */
export function senderLabel(msg: Pick<Message, 'authorName' | 'authorRole'>): string | null {
  const name = msg.authorName?.trim();
  if (!name && !msg.authorRole) return null;
  if (!msg.authorRole || msg.authorRole === name) return name || msg.authorRole || null;
  return name ? `${name} · ${msg.authorRole}` : msg.authorRole;
}

export const EDIT_WINDOW_MINUTES = 15;

/** Whether to offer Edit on this message (the server has the final say). */
export function canEditMessage(
  msg: Message,
  user: Pick<User, 'id' | 'role' | 'isSuperAdmin'> | null | undefined,
  windowExpiresAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!user || msg.direction !== 'OUTBOUND') return false;
  if (!msg.id || msg.id.startsWith('msg_')) return false; // not saved yet
  const isOwn = !!msg.authorId && msg.authorId === user.id;
  if (!isOwn && user.role !== 'ADMIN' && !user.isSuperAdmin) return false;
  if (msg.isInternalNote) return true;
  if (msg.templateId || msg.templateData || msg.mediaType || msg.status === 'FAILED') return false;
  if (now - new Date(msg.timestamp).getTime() > EDIT_WINDOW_MINUTES * 60_000) return false;
  return !!windowExpiresAt && new Date(windowExpiresAt).getTime() > now;
}
