import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';

@Injectable()
export class UserServiceClient {
  private readonly logger = new Logger(UserServiceClient.name);
  private readonly userServiceBaseUrl: string;

  constructor(private readonly configService: AppConfigService) {
    // Internal direct service-to-service communication URL (skips API Gateway for low latency)
    this.userServiceBaseUrl = process.env.USER_SERVICE_INTERNAL_URL || process.env.USER_SERVICE_URL || 'http://localhost:3001/api/v1';
  }

  async getAttorneyProfile(attorneyId: string, correlationId?: string): Promise<any> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (correlationId) {
        headers['x-correlation-id'] = correlationId;
      }

      const response = await fetch(`${this.userServiceBaseUrl}/attorneys/${attorneyId}`, { headers });
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
      return null;
    }
  }

  async getUserProfile(userId: string, correlationId?: string): Promise<any> {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (correlationId) {
        headers['x-correlation-id'] = correlationId;
      }

      const response = await fetch(`${this.userServiceBaseUrl}/users/${userId}`, { headers });
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
      return null;
    }
  }
}
