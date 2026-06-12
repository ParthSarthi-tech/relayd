import { randomBytes } from 'node:crypto'

/**
 * Generate a cryptographically random secret suitable for HMAC signing.
 * Returns a base64url-encoded string of 32 bytes (256 bits).
 */
export function generateSecret(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Generate a short, URL-safe ID for endpoint keys, etc.
 */
export function generateId(prefix: string): string {
  const id = randomBytes(12).toString('base64url')
  return `${prefix}_${id}`
}
