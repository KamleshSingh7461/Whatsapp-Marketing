// Invite links: whether one still works. No database here, so it can be checked with:
//   npx tsx src/auth/invite-status.logic.check.ts
import { randomBytes } from 'crypto';

/**
 * A revoked invite keeps its row (who was invited, by whom, when) but its secret is replaced by this prefix plus new
 * random bytes, so the link that was shared can never be looked up again. No schema change is needed.
 */
export const REVOKED_PREFIX = 'revoked_';

export const revokedToken = () => `${REVOKED_PREFIX}${randomBytes(24).toString('hex')}`;

export type InviteStatus = 'ACCEPTED' | 'REVOKED' | 'EXPIRED' | 'PENDING';

export function inviteStatus(invite: { token: string; usedAt: Date | null; expiresAt: Date }, now: Date = new Date()): InviteStatus {
  if (invite.usedAt) return 'ACCEPTED';
  if (invite.token.startsWith(REVOKED_PREFIX)) return 'REVOKED';
  if (invite.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return 'PENDING';
}

/** Only a pending invite's link can be used to create an account. */
export const inviteUsable = (invite: { token: string; usedAt: Date | null; expiresAt: Date } | null, now: Date = new Date()) =>
  !!invite && inviteStatus(invite, now) === 'PENDING';
