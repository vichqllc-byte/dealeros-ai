/**
 * Opaque token generation, HMAC signing, and hashing-at-rest helpers.
 *
 * Uses Web Crypto (`globalThis.crypto`) exclusively so the same code runs
 * unmodified in both the Node.js runtime (route handlers) and the Edge
 * runtime (middleware) - Prisma cannot run in Edge, so middleware verifies
 * token authenticity via HMAC signature only; expiry/revocation is checked
 * against the database in the Node runtime (route handlers / server
 * components), which is the actual security boundary.
 */

const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET;

function getSecretBytes(): Uint8Array {
  if (!AUTH_TOKEN_SECRET || AUTH_TOKEN_SECRET.length < 16) {
    throw new Error('AUTH_TOKEN_SECRET must be set to a strong random secret (16+ characters)');
  }
  return new TextEncoder().encode(AUTH_TOKEN_SECRET);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomId(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', getSecretBytes() as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(payload: string): Promise<string> {
  const key = await hmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

/** Creates a random opaque token bound with an HMAC signature: `<id>.<signature>`. */
export async function createSignedToken(): Promise<{ token: string; id: string }> {
  const id = randomId();
  const signature = await sign(id);
  return { token: `${id}.${signature}`, id };
}

/**
 * Verifies token structure and HMAC integrity only (no database access).
 * Safe to call from the Edge runtime (middleware). Does NOT check
 * expiry/revocation - callers must still verify against the database.
 */
export async function verifySignedTokenIntegrity(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [id, signature] = parts;
  if (!id || !signature) return null;

  try {
    const key = await hmacKey();
    const expected = fromBase64Url(signature) as BufferSource;
    const valid = await crypto.subtle.verify('HMAC', key, expected, new TextEncoder().encode(id));
    return valid ? id : null;
  } catch {
    return null;
  }
}

/** SHA-256 hash of a token/secret for at-rest storage (DB never stores raw tokens). */
export async function hashSecret(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(digest));
}

/** Generates a random single-use token (for email verification / password reset links). */
export function createRandomToken(): string {
  return randomId(32);
}
