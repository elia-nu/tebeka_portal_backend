import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';

@Injectable()
export class CommunicationServiceClient {
  private readonly logger = new Logger(CommunicationServiceClient.name);
  private readonly communicationServiceBaseUrl: string;

  constructor(private readonly configService: AppConfigService) {
    this.communicationServiceBaseUrl =
      process.env.COMMUNICATION_SERVICE_INTERNAL_URL ||
      process.env.COMMUNICATION_SERVICE_URL ||
      'http://localhost:3004/api/v1';
  }

  async getOrCreateBookingChat(bookingId: string, clientId: string, attorneyId: string, title?: string): Promise<any> {
    try {
      const response = await fetch(`${this.communicationServiceBaseUrl}/conversations/by-booking/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ clientId, attorneyId, title }),
      });
      if (!response.ok) {
        this.logger.warn(`Communication Service response for getOrCreateBookingChat(${bookingId}): ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (err: any) {
      this.logger.warn(`Communication Service unreachable on ${this.communicationServiceBaseUrl}: ${err.message}`);
      return null;
    }
  }

  async getOrCreateCaseChat(caseId: string, clientId: string, attorneyId: string, title?: string): Promise<any> {
    try {
      const response = await fetch(`${this.communicationServiceBaseUrl}/conversations/by-case/${caseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ clientId, attorneyId, title }),
      });
      if (!response.ok) {
        this.logger.warn(`Communication Service response for getOrCreateCaseChat(${caseId}): ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (err: any) {
      this.logger.warn(`Communication Service unreachable on ${this.communicationServiceBaseUrl}: ${err.message}`);
      return null;
    }
  }

  async dispatchNotification(payload: {
    recipientId: string;
    recipientEmail?: string;
    recipientPhone?: string;
    templateKey?: string;
    title?: string;
    body?: string;
    category?: string;
    variables?: Record<string, any>;
    locale?: string;
  }): Promise<any> {
    try {
      const response = await fetch(`${this.communicationServiceBaseUrl}/notifications/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        this.logger.warn(`Communication Service response for dispatchNotification: ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (err: any) {
      this.logger.warn(`Communication Service unreachable on ${this.communicationServiceBaseUrl}: ${err.message}`);
      return null;
    }
  }
}
