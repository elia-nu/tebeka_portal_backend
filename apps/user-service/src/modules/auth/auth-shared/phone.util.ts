import { BadRequestException } from '@nestjs/common';

export function validateEthiopianMobilePrefix(phone: string): string {
  if (!phone) {
    throw new BadRequestException('Phone number is required');
  }
  const cleanPhone = phone.trim();
  if (!cleanPhone.startsWith('+2519') && !cleanPhone.startsWith('+2517')) {
    throw new BadRequestException('Phone number must start with +2519 or +2517 (Ethiopian E.164 mobile format)');
  }
  return cleanPhone;
}
