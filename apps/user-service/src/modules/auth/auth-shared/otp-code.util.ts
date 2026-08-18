import { randomInt } from 'crypto';

/** Cryptographically secure 6-digit numeric code (100000-999999). */
export function generateNumericOtp(): string {
  return randomInt(100000, 1000000).toString();
}
