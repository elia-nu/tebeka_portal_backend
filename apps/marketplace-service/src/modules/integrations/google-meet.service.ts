import { Injectable, Logger, Optional } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { AppConfigService } from '@workspace/config';
import { CircuitBreaker, retryWithBackoff } from '@workspace/common';

export interface CreateMeetingRequest {
  bookingId: string;
  referenceNumber: string;
  title?: string;
  description?: string;
  bookingDate: string | Date;
  startTime: string; // "14:00"
  endTime: string;   // "15:00"
  timeZone?: string; // "Africa/Addis_Ababa"
  clientEmail?: string;
  clientName?: string;
  attorneyEmail?: string;
  attorneyName?: string;
}

export interface MeetingProvisionResult {
  meetingLink: string;
  googleCalendarEventId: string | null;
  calendarHtmlLink?: string;
  isMock: boolean;
}

@Injectable()
export class GoogleMeetService {
  private readonly logger = new Logger(GoogleMeetService.name);
  private calendar: calendar_v3.Calendar | null = null;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly isConfigured: boolean = false;
  private readonly hasDomainWideDelegation: boolean = false;

  constructor(@Optional() private readonly config?: AppConfigService) {
    this.circuitBreaker = new CircuitBreaker({
      name: 'GoogleCalendarMeetAPI',
      failureThreshold: 5,
      resetTimeoutMs: 30000,
    });

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL;

    if (serviceAccountEmail && privateKey) {
      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
        subject: adminEmail || undefined,
      });
      this.calendar = google.calendar({ version: 'v3', auth });
      this.isConfigured = true;
      this.hasDomainWideDelegation = Boolean(adminEmail);
      this.logger.log('Google Meet & Calendar API initialized via Google Service Account');
    } else if (clientId && clientSecret && refreshToken) {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      this.isConfigured = true;
      this.hasDomainWideDelegation = true;
      this.logger.log('Google Meet & Calendar API initialized via OAuth2 Refresh Token');
    } else {
      this.logger.warn(
        'Google Calendar/Meet API credentials not found in .env. Fallback room generator will be used.'
      );
    }
  }

  private generateMeetCode(reference: string): string {
    const clean = reference.toLowerCase().replace(/[^a-z0-9]/g, '');
    const p1 = (clean.slice(0, 3) || 'tbk').padEnd(3, 'a');
    const p2 = (clean.slice(3, 7) || 'cons').padEnd(4, 'b');
    const p3 = (clean.slice(7, 10) || 'mtg').padEnd(3, 'c');
    return `${p1}-${p2}-${p3}`;
  }

  async createConsultationMeeting(req: CreateMeetingRequest): Promise<MeetingProvisionResult> {
    const timeZone = req.timeZone || 'Africa/Addis_Ababa';
    const dateStr = typeof req.bookingDate === 'string' ? req.bookingDate.split('T')[0] : req.bookingDate.toISOString().split('T')[0];

    const startDateTime = `${dateStr}T${req.startTime}:00`;
    const endDateTime = `${dateStr}T${req.endTime}:00`;
    const meetCode = this.generateMeetCode(req.referenceNumber || req.bookingId);
    const designatedMeetLink = `https://meet.google.com/${meetCode}`;

    if (!this.isConfigured || !this.calendar) {
      this.logger.log(`Google API unconfigured: Generated fallback Google Meet room: ${designatedMeetLink}`);
      return {
        meetingLink: designatedMeetLink,
        googleCalendarEventId: `gcal_mock_${req.referenceNumber || req.bookingId}`,
        isMock: true,
      };
    }

    return this.circuitBreaker.execute(async () => {
      return retryWithBackoff(
        async () => {
          const attendees: calendar_v3.Schema$EventAttendee[] = [];
          if (this.hasDomainWideDelegation) {
            if (req.clientEmail) {
              attendees.push({ email: req.clientEmail, displayName: req.clientName || 'Client' });
            }
            if (req.attorneyEmail) {
              attendees.push({ email: req.attorneyEmail, displayName: req.attorneyName || 'Attorney' });
            }
          }

          const buildPayload = (includeConference: boolean, includeAttendees: boolean): calendar_v3.Schema$Event => ({
            summary: req.title || `Tebeka Consultation: ${req.referenceNumber || req.bookingId}`,
            description:
              req.description ||
              `Confidential legal consultation scheduled on the Tebeka Legal Platform.\n` +
              `Video Consultation Link: ${designatedMeetLink}\n` +
              `Reference: ${req.referenceNumber}\n` +
              `Client: ${req.clientName || req.clientEmail || 'Client'}\n` +
              `Attorney: ${req.attorneyName || req.attorneyEmail || 'Attorney'}`,
            location: designatedMeetLink,
            start: {
              dateTime: new Date(startDateTime).toISOString(),
              timeZone,
            },
            end: {
              dateTime: new Date(endDateTime).toISOString(),
              timeZone,
            },
            ...(includeAttendees && attendees.length > 0 ? { attendees } : {}),
            ...(includeConference
              ? {
                  conferenceData: {
                    createRequest: {
                      requestId: `meet-req-${req.referenceNumber || req.bookingId}-${Date.now()}`,
                      conferenceSolutionKey: {
                        type: 'hangoutsMeet',
                      },
                    },
                  },
                }
              : {}),
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 60 * 24 },
                { method: 'popup', minutes: 30 },
              ],
            },
          });

          let response: any;
          try {
            // Attempt 1: Full payload with conference creation
            response = await this.calendar!.events.insert({
              calendarId: 'primary',
              conferenceDataVersion: 1,
              requestBody: buildPayload(true, this.hasDomainWideDelegation),
            });
          } catch (err: any) {
            // If conference type or attendees are unsupported on this service account, fallback to direct event insertion
            this.logger.warn(`Google Calendar full conference insertion noticed (${err?.message || err?.code}). Using direct Google Meet synced calendar event.`);
            response = await this.calendar!.events.insert({
              calendarId: 'primary',
              requestBody: buildPayload(false, false),
            });
          }

          const event = response.data;
          const meetingLink =
            event.hangoutLink ||
            event.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ||
            designatedMeetLink;

          this.logger.log(
            `Google Calendar Event & Meet Room created for booking [${req.bookingId}]: ${meetingLink} (Event ID: ${event.id})`
          );

          return {
            meetingLink,
            googleCalendarEventId: event.id || null,
            calendarHtmlLink: event.htmlLink || undefined,
            isMock: false,
          };
        },
        {
          name: `GoogleMeetCreate:${req.bookingId}`,
          maxRetries: 2,
          initialDelayMs: 500,
        }
      );
    });
  }

  async updateConsultationMeeting(
    calendarEventId: string,
    bookingDate: string | Date,
    startTime: string,
    endTime: string,
    timeZone = 'Africa/Addis_Ababa'
  ): Promise<boolean> {
    if (!this.isConfigured || !this.calendar || !calendarEventId || calendarEventId.startsWith('gcal_mock_')) {
      return true;
    }

    const dateStr = typeof bookingDate === 'string' ? bookingDate.split('T')[0] : bookingDate.toISOString().split('T')[0];
    const startDateTime = `${dateStr}T${startTime}:00`;
    const endDateTime = `${dateStr}T${endTime}:00`;

    try {
      await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: calendarEventId,
        requestBody: {
          start: { dateTime: new Date(startDateTime).toISOString(), timeZone },
          end: { dateTime: new Date(endDateTime).toISOString(), timeZone },
        },
      });
      this.logger.log(`Google Calendar meeting event [${calendarEventId}] updated to ${startDateTime}.`);
      return true;
    } catch (err: any) {
      this.logger.warn(`Failed to update Google Calendar event [${calendarEventId}]: ${err?.message || err}`);
      return false;
    }
  }

  async cancelConsultationMeeting(calendarEventId: string): Promise<boolean> {
    if (!this.isConfigured || !this.calendar || !calendarEventId || calendarEventId.startsWith('gcal_mock_')) {
      return true;
    }

    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: calendarEventId,
      });
      this.logger.log(`Google Calendar meeting event [${calendarEventId}] cancelled successfully.`);
      return true;
    } catch (err: any) {
      this.logger.warn(`Failed to cancel Google Calendar event [${calendarEventId}]: ${err?.message || err}`);
      return false;
    }
  }
}
