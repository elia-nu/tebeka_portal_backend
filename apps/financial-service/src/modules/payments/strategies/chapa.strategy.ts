import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';
import { IPaymentProviderStrategy, PaymentCheckoutRequest, PaymentCheckoutResponse } from './payment-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class ChapaStrategy implements IPaymentProviderStrategy {
  private readonly logger = new Logger(ChapaStrategy.name);
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.chapa.co/v1';

  constructor(private readonly config: AppConfigService) {
    this.secretKey = process.env.CHAPA_SECRET_KEY || 'CHASECK_TEST-mock-chapa-secret-key';
  }

  async initializePayment(request: PaymentCheckoutRequest): Promise<PaymentCheckoutResponse> {
    try {
      const payload = {
        amount: String(request.amount),
        currency: request.currency || 'ETB',
        email: request.email || 'customer@tebeka.et',
        first_name: request.firstName || 'Client',
        last_name: request.lastName || 'User',
        phone_number: request.phone || '',
        tx_ref: request.txRef,
        callback_url: request.callbackUrl || 'https://api.tebeka.et/api/v1/payments/webhooks/chapa',
        return_url: request.returnUrl || 'https://tebeka.et/payment/complete',
        'customization[title]': 'Tebeka Legal Services',
        'customization[description]': `Payment for reference ${request.txRef}`,
      };

      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resData: any = await response.json();
      this.logger.log(`Chapa initialize response for ${request.txRef}: ${JSON.stringify(resData)}`);

      if (resData.status === 'success' && resData.data?.checkout_url) {
        return {
          status: 'success',
          checkoutUrl: resData.data.checkout_url,
          transactionReference: request.txRef,
          rawResponse: resData,
        };
      }

      return {
        status: 'pending',
        checkoutUrl: `https://checkout.chapa.co/checkout/payment/${request.txRef}`,
        transactionReference: request.txRef,
        rawResponse: resData,
      };
    } catch (err: any) {
      this.logger.error(`Chapa initialization failed for txRef ${request.txRef}: ${err?.message || err}`);
      return {
        status: 'pending',
        checkoutUrl: `https://checkout.chapa.co/checkout/payment/${request.txRef}`,
        transactionReference: request.txRef,
      };
    }
  }

  async verifyPayment(transactionReference: string): Promise<{ status: 'COMPLETED' | 'FAILED' | 'PENDING'; amount: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/transaction/verify/${transactionReference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const resData: any = await response.json();
      if (resData.status === 'success' && resData.data?.status === 'success') {
        return {
          status: 'COMPLETED',
          amount: Number(resData.data.amount || 0),
        };
      }
      return { status: 'FAILED', amount: 0 };
    } catch (err: any) {
      this.logger.error(`Chapa verification error for ${transactionReference}: ${err?.message || err}`);
      return { status: 'PENDING', amount: 0 };
    }
  }

  verifyWebhookSignature(signature: string, payload: any): boolean {
    if (!signature) return false;
    const hash = crypto.createHmac('sha256', this.secretKey).update(JSON.stringify(payload)).digest('hex');
    return hash === signature;
  }
}
