// ============================================================
// Short code for share links — a short, readable URL for clients
// Unambiguous letters/digits (no 0/O, 1/l/I) — length 7
// ============================================================

import crypto from 'crypto';

// Ambiguous characters removed from the alphabet
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SHORT_CODE_LENGTH = 7;

/** Generates a random short code */
export function generateShortCode(length = SHORT_CODE_LENGTH): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * resolve input: a full signed token (including the dot) or a short code
 */
export function isFullToken(value: string): boolean {
  return value.includes('.');
}
