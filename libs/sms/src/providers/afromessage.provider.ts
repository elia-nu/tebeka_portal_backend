import { Injectable, Optional } from '@nestjs/common';
import { AppLoggerService } from '@workspace/logger';
import { ISmsProvider, SendSmsOptions, SendOtpOptions, SmsDispatchResult, SmsBalanceResult } from '../types/sms.types';
import { validateEthiopianMobilePrefix } from '../utils/phone.util';

@Injectable()
export class AfroMessageProvider implements ISmsProvider {
  private readonly logger: AppLoggerService;

  constructor(@Optional() logger?: AppLoggerService) {
    this.logger = logger || new AppLoggerService('AfroMessageProvider');
  }

  private getToken(): string | undefined {
    return process.env.AFROMESSAGE_TOKEN;
  }

  private getBaseUrl(): string {
    return process.env.AFROMESSAGE_BASE_URL || 'https://api.afromessage.com/api';
  }

  private getDefaultSender(): string | undefined {
    return process.env.AFROMESSAGE_SENDER || 'Tebeka.et';
  }

  private getDefaultIdentifier(): string | undefined {
    return process.env.AFROMESSAGE_IDENTIFIER;
  }

  /**
   * Sends an SMS message to an Ethiopian phone number via AfroMessage API.
   * Automatically normalizes the phone number, handles sender retry, and returns structured result.
   */
  async sendSms(options: SendSmsOptions): Promise<SmsDispatchResult> {
    const token = this.getToken();
    const baseUrl = this.getBaseUrl();
    const phone = validateEthiopianMobilePrefix(options.to);
    const sender = options.sender !== undefined ? options.sender : this.getDefaultSender();
    const identifier = options.from !== undefined ? options.from : this.getDefaultIdentifier();

    if (!token) {
      this.logger.warn(`AFROMESSAGE_TOKEN not set. Mocking SMS dispatch to ${phone}: "${options.message}"`, 'AfroMessageProvider');
      return {
        success: false,
        to: phone,
        provider: 'AFROMESSAGE',
        error: 'AFROMESSAGE_TOKEN not configured',
      };
    }

    try {
      const queryParams = new URLSearchParams({
        to: phone,
        message: options.message,
      });

      if (identifier) queryParams.set('from', identifier);
      if (sender) queryParams.set('sender', sender);
      if (options.callback) queryParams.set('callback', options.callback);

      let senderUsed = sender;
      let apiRes = await fetch(`${baseUrl}/send?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      let resData: any = await apiRes.json().catch(() => null);

      // If custom sender ID is rejected (e.g. unapproved custom sender ID), retry with default system sender
      if (resData?.acknowledge === 'error' && sender && resData?.response?.errors?.[0]?.includes('sender id/name')) {
        this.logger.warn(`Custom sender '${sender}' rejected by AfroMessage. Retrying with default system sender...`, 'AfroMessageProvider');
        queryParams.delete('sender');
        senderUsed = undefined;

        apiRes = await fetch(`${baseUrl}/send?${queryParams.toString()}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        resData = await apiRes.json().catch(() => null);
      }

      const isSuccess = apiRes.ok && resData?.acknowledge === 'success';
      const messageId = resData?.response?.message_id || resData?.response?.id;
      const status = resData?.response?.status || (isSuccess ? 'DELIVERED' : 'FAILED');

      this.logger.log(`AfroMessage SMS result for ${phone}: status=${apiRes.status}, success=${isSuccess}, messageId=${messageId || 'N/A'}`, 'AfroMessageProvider');

      return {
        success: isSuccess,
        messageId,
        status,
        to: phone,
        provider: 'AFROMESSAGE',
        senderUsed,
        responseData: resData,
        error: isSuccess ? undefined : resData?.response?.errors?.join(', ') || `HTTP ${apiRes.status}`,
      };
    } catch (error: any) {
      this.logger.error(`AfroMessage SMS dispatch error for ${phone}: ${error?.message || error}`, error?.stack, 'AfroMessageProvider');
      return {
        success: false,
        to: phone,
        provider: 'AFROMESSAGE',
        error: error?.message || String(error),
      };
    }
  }

  /**
   * Helper to format and dispatch standard Tebeka OTP verification codes.
   */
  async sendOtp(options: SendOtpOptions): Promise<SmsDispatchResult> {
    const validity = options.validityMinutes || 5;
    const purposeText = options.purpose ? ` for ${options.purpose.toLowerCase()}` : '';
    const message = `Your Tebeka Legal Portal verification code is: ${options.otpCode}.${purposeText} Valid for ${validity} minutes.`;

    return this.sendSms({
      to: options.to,
      message,
      from: options.from,
      sender: options.sender,
    });
  }

  /**
   * Queries the AfroMessage account balance and remaining estimated message units.
   */
  async checkBalance(): Promise<SmsBalanceResult> {
    const token = this.getToken();
    const baseUrl = this.getBaseUrl();

    if (!token) {
      return {
        success: false,
        provider: 'AFROMESSAGE',
        error: 'AFROMESSAGE_TOKEN not configured',
      };
    }

    try {
      const res = await fetch(`${baseUrl}/balance`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const data: any = await res.json().catch(() => null);

      if (res.ok && data?.acknowledge === 'success') {
        return {
          success: true,
          estimatedMessages: data?.response?.estimatedMessages,
          balance: data?.response?.balance,
          currency: 'ETB',
          provider: 'AFROMESSAGE',
          responseData: data,
        };
      }

      return {
        success: false,
        provider: 'AFROMESSAGE',
        error: data?.response?.errors?.join(', ') || `HTTP ${res.status}`,
        responseData: data,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'AFROMESSAGE',
        error: err?.message || String(err),
      };
    }
  }
}
