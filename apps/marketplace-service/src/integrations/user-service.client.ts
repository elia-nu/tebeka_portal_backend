import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';
import { CircuitBreaker } from '@workspace/common';

@Injectable()
export class UserServiceClient {
  private readonly logger = new Logger(UserServiceClient.name);
  private readonly userServiceBaseUrl: string;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(private readonly configService: AppConfigService) {
    // Internal direct service-to-service communication URL (skips API Gateway for low latency)
    this.userServiceBaseUrl = process.env.USER_SERVICE_INTERNAL_URL || process.env.USER_SERVICE_URL || 'http://localhost:3001/api/v1';

    this.circuitBreaker = new CircuitBreaker({
      name: 'Marketplace->UserService',
      failureThreshold: 4,
      resetTimeoutMs: 15000,
      fallback: (err) => {
        this.logger.warn(`Circuit breaker fallback invoked for UserService: ${err?.message}`);
        return null;
      },
    });
  }

  async getAttorneyProfile(attorneyId: string, correlationId?: string): Promise<any> {
    return this.circuitBreaker.execute(async () => {
      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
          'x-internal-service-key': this.configService.internalServiceSecret,
        };
        if (correlationId) {
          headers['x-correlation-id'] = correlationId;
        }

        const response = await fetch(`${this.userServiceBaseUrl}/attorneys/${attorneyId}`, {
          headers,
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          this.logger.warn(`User Service response for getAttorneyProfile(${attorneyId}): ${response.status} ${response.statusText}`);
          return null;
        }
        return await response.json();
      } catch (err: any) {
        if (err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED')) {
          this.logger.warn(`User Service is initializing or unreachable on ${this.userServiceBaseUrl} (${err.message})`);
        } else {
          this.logger.error(`Error in UserServiceClient.getAttorneyProfile(${attorneyId}): ${err.message}`);
        }
        throw err;
      }
    });
  }

  async getUserProfile(userId: string, correlationId?: string): Promise<any> {
    return this.circuitBreaker.execute(async () => {
      try {
        const headers: Record<string, string> = {
          Accept: 'application/json',
          'x-internal-service-key': this.configService.internalServiceSecret,
        };
        if (correlationId) {
          headers['x-correlation-id'] = correlationId;
        }

        const response = await fetch(`${this.userServiceBaseUrl}/users/${userId}`, {
          headers,
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          this.logger.warn(`User Service response for getUserProfile(${userId}): ${response.status} ${response.statusText}`);
          return null;
        }
        return await response.json();
      } catch (err: any) {
        if (err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED')) {
          this.logger.warn(`User Service is initializing or unreachable on ${this.userServiceBaseUrl} (${err.message})`);
        } else {
          this.logger.error(`Error in UserServiceClient.getUserProfile(${userId}): ${err.message}`);
        }
        throw err;
      }
    });
  }
}
