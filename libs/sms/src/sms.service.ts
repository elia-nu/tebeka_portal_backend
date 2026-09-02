import { Injectable } from '@nestjs/common';
import { AfroMessageProvider } from './providers/afromessage.provider';
import { SendSmsOptions, SendOtpOptions, SmsDispatchResult, SmsBalanceResult } from './types/sms.types';
import { validateEthiopianMobilePrefix, isValidEthiopianMobile, normalizeEthiopianPhoneSafe } from './utils/phone.util';

@Injectable()
export class SmsService {
  constructor(private readonly afroMessageProvider: AfroMessageProvider) {}

  /**
   * Dispatches a single SMS text message to an Ethiopian phone number.
   */
  async sendSms(options: SendSmsOptions): Promise<SmsDispatchResult> {
    return this.afroMessageProvider.sendSms(options);
  }

  /**
   * Dispatches an OTP verification code SMS with custom validity and purpose.
   */
  async sendOtp(options: SendOtpOptions): Promise<SmsDispatchResult> {
    return this.afroMessageProvider.sendOtp(options);
  }

  /**
   * Checks the remaining balance and estimated message units on the SMS gateway.
   */
  async checkBalance(): Promise<SmsBalanceResult> {
    return this.afroMessageProvider.checkBalance();
  }

  /**
   * Normalizes an Ethiopian phone number to E.164 format (+2519... or +2517...).
   * Throws BadRequestException if invalid.
   */
  normalizePhone(phone: string): string {
    return validateEthiopianMobilePrefix(phone);
  }

  /**
   * Validates if a phone number string is a valid Ethiopian mobile number.
   */
  isValidPhone(phone: string): boolean {
    return isValidEthiopianMobile(phone);
  }

  /**
   * Safe phone normalization without throwing.
   */
  normalizePhoneSafe(phone: string): string | null {
    return normalizeEthiopianPhoneSafe(phone);
  }
}
