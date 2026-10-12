import { randomInt } from 'crypto';

// Crockford base32 minus visually ambiguous chars (I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 5;

/**
 * Generate a short, human-friendly order reference, e.g. "PK7BN".
 * Shown to staff and admins so an order can be identified at a glance.
 */
export function generateOrderReference(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `PK${code}`;
}
