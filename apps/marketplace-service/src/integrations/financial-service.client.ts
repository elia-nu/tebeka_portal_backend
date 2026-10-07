import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';
import { CircuitBreaker } from '@workspace/common';

@Injectable()
export class FinancialServiceClient {
  private readonly logger = new Logger(FinancialServiceClient.name);
  private readonly financialServiceBaseUrl: string;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(private readonly configService: AppConfigService) {
    const rawUrl =
      process.env.FINANCIAL_SERVICE_INTERNAL_URL ||
      process.env.FINANCIAL_SERVICE_URL ||
      'http://127.0.0.1:7003/api/v1';

    this.financialServiceBaseUrl = rawUrl.includes('/api/v1')
      ? rawUrl.replace(/\/$/, '')
      : `${rawUrl.replace(/\/$/, '')}/api/v1`;

    this.circuitBreaker = new CircuitBreaker({
      name: 'Marketplace->FinancialService',
      failureThreshold: 4,
      resetTimeoutMs: 15000,
      fallback: (err) => {
        this.logger.warn(`Circuit breaker fallback invoked for FinancialService: ${err?.message}`);
        return null;
      },
    });
  }

  async createPayment(payload: {
    bookingId: string;
    payerId: string;
    payeeId: string;
    paymentType: string;
    amount: number;
    currency?: string;
    provider?: string;
    email?: string;
    phone?: string;
    description?: string;
  }, correlationId?: string): Promise<any> {
    return this.circuitBreaker.execute(async () => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-internal-service-key': this.configService.internalServiceSecret || 'tebeka-internal-secret-change-in-production',
        };
        if (correlationId) {
          headers['x-correlation-id'] = correlationId;
        }

        const url = this.financialServiceBaseUrl.endsWith('/payments')
          ? this.financialServiceBaseUrl
          : `${this.financialServiceBaseUrl}/payments`;

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          this.logger.error(`Financial Service error [${response.status}]: ${errorBody}`);
          throw new Error(`Financial Service error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      } catch (err: any) {
        this.logger.error(`Failed to create payment in FinancialServiceClient: ${err.message}`);
        throw err;
      }
    });
  }
}
