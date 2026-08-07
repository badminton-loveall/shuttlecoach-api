import crypto from 'crypto';

/** Generate a cryptographically random 32-byte token as hex string (64 chars) */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Hash a token using SHA-256 for secure storage */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
