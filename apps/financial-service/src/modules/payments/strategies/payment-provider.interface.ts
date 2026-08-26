export interface PaymentCheckoutRequest {
  paymentId: string;
  amount: number;
  currency: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  txRef: string;
  subaccountId?: string;
  stripeAccountId?: string;
  commission?: number;
  splitPercentage?: number;
  callbackUrl?: string;
  returnUrl?: string;
}

export interface PaymentCheckoutResponse {
  status: 'success' | 'pending' | 'failed';
  checkoutUrl?: string;
  transactionReference: string;
  providerPaymentId?: string;
  rawResponse?: any;
}

export interface IPaymentProviderStrategy {
  initializePayment(request: PaymentCheckoutRequest): Promise<PaymentCheckoutResponse>;
  verifyPayment(transactionReference: string): Promise<{ status: 'COMPLETED' | 'FAILED' | 'PENDING'; amount: number }>;
  verifyWebhookSignature(signature: string, payload: any, rawBody?: Buffer | string): boolean;
}
