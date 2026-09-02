import { BadRequestException } from '@nestjs/common';

/**
 * Validates and normalizes an Ethiopian mobile phone number to standard E.164 format (+2519xxxxxxxx or +2517xxxxxxxx).
 * Accepts various valid user inputs:
 *  - '0911223344'   -> '+251911223344'
 *  - '0711223344'   -> '+251711223344'
 *  - '251911223344' -> '+251911223344'
 *  - '251711223344' -> '+251711223344'
 *  - '+251911223344'-> '+251911223344'
 *  - '+251711223344'-> '+251711223344'
 */
export function validateEthiopianMobilePrefix(phone: string): string {
  if (!phone) {
    throw new BadRequestException('Phone number is required');
  }
  let cleanPhone = String(phone).trim().replace(/[\s\-()]/g, '');

  if (cleanPhone.startsWith('09') && cleanPhone.length === 10) {
    cleanPhone = '+251' + cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('07') && cleanPhone.length === 10) {
    cleanPhone = '+251' + cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('2519') && cleanPhone.length === 12) {
    cleanPhone = '+' + cleanPhone;
  } else if (cleanPhone.startsWith('2517') && cleanPhone.length === 12) {
    cleanPhone = '+' + cleanPhone;
  }

  if (!cleanPhone.startsWith('+2519') && !cleanPhone.startsWith('+2517')) {
    throw new BadRequestException('Phone number must start with +2519 or +2517 (Ethiopian E.164 mobile format)');
  }
  if (cleanPhone.length !== 13) {
    throw new BadRequestException('Phone number must be a valid Ethiopian mobile number (+2519xxxxxxxx or +2517xxxxxxxx)');
  }
  return cleanPhone;
}

/**
 * Returns true if the phone number can be normalized into a valid Ethiopian mobile number.
 */
export function isValidEthiopianMobile(phone: string): boolean {
  try {
    validateEthiopianMobilePrefix(phone);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalizes phone number, returning null if invalid instead of throwing.
 */
export function normalizeEthiopianPhoneSafe(phone: string): string | null {
  try {
    return validateEthiopianMobilePrefix(phone);
  } catch {
    return null;
  }
}
