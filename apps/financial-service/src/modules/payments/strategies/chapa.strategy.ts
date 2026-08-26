import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';
import { IPaymentProviderStrategy, PaymentCheckoutRequest, PaymentCheckoutResponse } from './payment-provider.interface';
import { CircuitBreaker, retryWithBackoff } from '@workspace/common';
import * as crypto from 'crypto';

@Injectable()
export class ChapaStrategy implements IPaymentProviderStrategy {
  private readonly logger = new Logger(ChapaStrategy.name);
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.chapa.co/v1';
  private readonly circuitBreaker: CircuitBreaker;

  constructor(private readonly config: AppConfigService) {
    this.secretKey = process.env.CHAPA_SECRET || process.env.CHAPA_SECRET_KEY || '';
    this.circuitBreaker = new CircuitBreaker({
      name: 'ChapaPaymentGateway',
      failureThreshold: 5,
      resetTimeoutMs: 20000,
    });
  }

  async initializePayment(request: PaymentCheckoutRequest): Promise<PaymentCheckoutResponse> {
    if (!this.secretKey) {
      throw new InternalServerErrorException('CHAPA_SECRET_KEY is not configured on the server.');
    }

    return this.circuitBreaker.execute(async () => {
      return retryWithBackoff(
        async (attempt) => {
          const payload: Record<string, any> = {
            amount: String(request.amount),
            currency: request.currency || 'ETB',
            email: request.email || 'customer@gmail.com',
            first_name: request.firstName || 'Client',
            last_name: request.lastName || 'User',
            phone_number: request.phone || '',
            tx_ref: request.txRef,
            callback_url: request.callbackUrl || 'https://api.tebeka.et/api/v1/payments/webhooks/chapa',
            return_url: request.returnUrl || 'https://tebeka.et/payment/complete',
            'customization[title]': 'Tebeka Legal Services',
            'customization[description]': `Payment for reference ${request.txRef}`,
          };

          // Support Chapa Split Payment via subaccount_id
          if (request.subaccountId) {
            payload.subaccount_id = request.subaccountId;
          }

          const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.secretKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000),
          });

          const resData: any = await response.json();
          this.logger.log(`Chapa initialize response for [${request.txRef}] (attempt ${attempt}): status=${resData.status}`);

          if (resData.status === 'success' && resData.data?.checkout_url) {
            return {
              status: 'success',
              checkoutUrl: resData.data.checkout_url,
              transactionReference: request.txRef,
              rawResponse: resData,
            };
          }

          // If Chapa returns client error like invalid parameters, throw BadRequestException (won't retry)
          throw new BadRequestException(
            resData.message || `Chapa payment initialization failed for transaction reference ${request.txRef}`
          );
        },
        {
          name: `ChapaInitialize:${request.txRef}`,
          maxRetries: 2,
          initialDelayMs: 300,
          shouldRetry: (err) => !(err instanceof BadRequestException),
        }
      );
    });
  }

  async verifyPayment(
    transactionReference: string
  ): Promise<{ status: 'COMPLETED' | 'FAILED' | 'PENDING'; amount: number }> {
    if (!this.secretKey) {
      throw new InternalServerErrorException('CHAPA_SECRET_KEY is not configured on the server.');
    }

    return this.circuitBreaker.execute(async () => {
      const response = await fetch(`${this.baseUrl}/transaction/verify/${transactionReference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      const resData: any = await response.json();
      if (resData.status === 'success' && resData.data?.status === 'success') {
        return {
          status: 'COMPLETED',
          amount: Number(resData.data.amount || 0),
        };
      }

      this.logger.warn(`Chapa verification failed for [${transactionReference}]: ${resData.message || 'Payment not completed'}`);
      return { status: 'FAILED', amount: 0 };
    });
  }

  async createSubaccount(data: {
    businessName: string;
    accountName: string;
    bankCode: string | number;
    accountNumber: string;
    splitValue: number;
    splitType?: 'percentage' | 'flat';
  }): Promise<{ status: string; subaccountId: string; message: string }> {
    if (!this.secretKey) {
      throw new InternalServerErrorException('CHAPA_SECRET_KEY is not configured on the server.');
    }

    return this.circuitBreaker.execute(async () => {
      const payload = {
        business_name: data.businessName,
        account_name: data.accountName,
        bank_code: data.bankCode,
        account_number: data.accountNumber,
        split_type: data.splitType || 'percentage',
        split_value: data.splitValue,
      };

      const response = await fetch(`${this.baseUrl}/subaccount`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      const resData: any = await response.json();
      this.logger.log(`Chapa createSubaccount response: ${JSON.stringify(resData)}`);

      if (resData.status === 'success' && resData.data?.subaccount_id) {
        return {
          status: 'success',
          subaccountId: resData.data.subaccount_id,
          message: resData.message || 'Subaccount created successfully',
        };
      }

      throw new BadRequestException(
        resData.message || 'Failed to create payout subaccount with Chapa. Please verify bank details.'
      );
    });
  }

  async getBanks(): Promise<any[]> {
    const fallbackBanks = [
      { id: 'cbe', name: 'Commercial Bank of Ethiopia (CBE)', code: 'cbe' },
      { id: 'awash', name: 'Awash International Bank', code: 'awash' },
      { id: 'dashen', name: 'Dashen Bank', code: 'dashen' },
      { id: 'abyssinia', name: 'Bank of Abyssinia', code: 'boa' },
      { id: 'telebirr', name: 'Telebirr Payout Subaccount', code: 'telebirr' },
      { id: 'hibret', name: 'Hibret Bank', code: 'hibret' },
      { id: 'cbo', name: 'Cooperative Bank of Oromia', code: 'cbo' },
      { id: 'nib', name: 'Nib International Bank', code: 'nib' },
      { id: 'zemen', name: 'Zemen Bank', code: 'zemen' },
    ];

    if (!this.secretKey) {
      return fallbackBanks;
    }

    try {
      return await this.circuitBreaker.execute(async () => {
        const response = await fetch(`${this.baseUrl}/banks`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
          signal: AbortSignal.timeout(15000),
        });
        const resData: any = await response.json();
        if (resData.status === 'success' && Array.isArray(resData.data) && resData.data.length > 0) {
          return resData.data;
        }
        return fallbackBanks;
      });
    } catch (err: any) {
      this.logger.warn(`Chapa bank list fetch note: ${err.message} - using standard bank catalog`);
      return fallbackBanks;
    }
  }

  verifyWebhookSignature(signature: string, payload: any, rawBody?: Buffer | string): boolean {
    if (!signature) return false;
    const secret = process.env.CHAPA_WEBHOOK_SECRET_HASH || this.secretKey;
    if (!secret) return true;

    // 1. Direct secret hash comparison (Chapa secret hash mode)
    if (signature === secret) return true;

    // 2. HMAC-SHA256 signature calculation over raw or stringified payload
    try {
      const payloadStr = rawBody
        ? (Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody))
        : (typeof payload === 'string' ? payload : JSON.stringify(payload));

      const hash = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

      if (hash.toLowerCase() === signature.toLowerCase()) {
        return true;
      }

      // Timing-safe comparison if lengths match
      const signatureBuf = Buffer.from(signature.toLowerCase(), 'utf8');
      const hashBuf = Buffer.from(hash.toLowerCase(), 'utf8');
      if (signatureBuf.length === hashBuf.length && crypto.timingSafeEqual(signatureBuf, hashBuf)) {
        return true;
      }
    } catch (err: any) {
      this.logger.warn(`Chapa signature check exception: ${err.message}`);
    }

    return false;
  }

  getCircuitBreakerMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}
