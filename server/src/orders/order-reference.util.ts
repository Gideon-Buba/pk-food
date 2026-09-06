import { randomInt } from 'crypto';

// Crockford base32 minus visually ambiguous chars (I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 5;

/**
 * Generate a short, human-friendly order reference, e.g. "PK7BN".
 * The buyer quotes this as the bank-transfer narration; the admin matches
 * the bank statement against it.
 */
export function generateOrderReference(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `PK${code}`;
}
