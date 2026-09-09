import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM encryption for WABA business tokens at rest (§11 of the plan).
 * ENCRYPTION_KEY must be a 32-byte key, base64-encoded, kept out of source
 * control. Swap for a managed KMS before handling real production tokens.
 */
const ALGORITHM = 'aes-256-gcm';

export function encryptToken(plaintext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptToken(payloadBase64: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  const payload = Buffer.from(payloadBase64, 'base64');
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
