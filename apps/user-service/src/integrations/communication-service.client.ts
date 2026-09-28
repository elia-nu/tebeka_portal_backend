import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';
import { CircuitBreaker } from '@workspace/common';

@Injectable()
export class CommunicationServiceClient {
  private readonly logger = new Logger(CommunicationServiceClient.name);
  private readonly communicationServiceBaseUrl: string;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(private readonly configService: AppConfigService) {
    this.communicationServiceBaseUrl =
      process.env.COMMUNICATION_SERVICE_INTERNAL_URL ||
      process.env.COMMUNICATION_SERVICE_URL ||
      'http://localhost:3004/api/v1/communication';

    this.circuitBreaker = new CircuitBreaker({
      name: 'UserService->CommunicationService',
      failureThreshold: 3,
      resetTimeoutMs: 15000,
      fallback: (err) => {
        this.logger.warn(`Circuit breaker open or fallback invoked for CommunicationService: ${err?.message}`);
        return null;
      },
    });
  }

  async dispatchNotification(
    payload: {
      recipientId: string;
      recipientEmail?: string;
      recipientPhone?: string;
      templateKey?: string;
      title?: string;
      body?: string;
      category?: string;
      channels?: string[];
      priority?: string;
      actionUrl?: string;
      referenceNumber?: string;
      variables?: Record<string, any>;
      locale?: string;
    },
    correlationId?: string
  ): Promise<any> {
    return this.circuitBreaker.execute(async () => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-internal-service-key': this.configService.internalServiceSecret,
        };
        if (correlationId) {
          headers['x-correlation-id'] = correlationId;
        }

        const response = await fetch(`${this.communicationServiceBaseUrl}/notifications/dispatch`, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(3000),
          body: JSON.stringify({
            ...payload,
            channels: payload.channels || ['IN_APP', 'PUSH'],
          }),
        });

        if (!response.ok) {
          this.logger.warn(`Communication Service response for dispatchNotification: ${response.status}`);
          return null;
        }
        return await response.json();
      } catch (err: any) {
        this.logger.warn(`Communication Service unreachable on ${this.communicationServiceBaseUrl}: ${err.message}`);
        throw err;
      }
    });
  }
}
