import { Test, TestingModule } from '@nestjs/testing';
import { GoogleMeetService, CreateMeetingRequest } from './google-meet.service';

describe('GoogleMeetService', () => {
  let service: GoogleMeetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleMeetService],
    }).compile();

    service = module.get<GoogleMeetService>(GoogleMeetService);
  });

  describe('generateMeetCode and generateMeetLink', () => {
    it('should generate a 10-letter lowercase code with 3-4-3 hyphenated format', () => {
      const meetCode = service.generateMeetCode('TBK-2026-001');
      expect(meetCode).toMatch(/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
    });

    it('should generate a valid Google Meet link URL matching standard format', () => {
      const meetLink = service.generateMeetLink('booking-uuid-12345');
      expect(meetLink).toMatch(/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
    });

    it('should be deterministic for the same reference identifier', () => {
      const code1 = service.generateMeetCode('reference-xyz');
      const code2 = service.generateMeetCode('reference-xyz');
      expect(code1).toBe(code2);
    });

    it('should handle undefined or empty reference gracefully', () => {
      const code = service.generateMeetCode('');
      expect(code).toMatch(/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
    });
  });

  describe('createConsultationMeeting', () => {
    const sampleRequest: CreateMeetingRequest = {
      bookingId: 'booking-999',
      referenceNumber: 'TBK-2026-999',
      bookingDate: '2026-11-15',
      startTime: '09:00',
      endTime: '10:00',
      clientEmail: 'client@example.com',
      clientName: 'Abebe Bikila',
      attorneyEmail: 'attorney@example.com',
      attorneyName: 'Advocate Alula',
    };

    it('should generate a valid fallback Google Meet link and event ID when unconfigured', async () => {
      (service as any).isConfigured = false;
      (service as any).calendar = null;

      const result = await service.createConsultationMeeting(sampleRequest);

      expect(result).toBeDefined();
      expect(result.meetingLink).toMatch(/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
      expect(result.googleCalendarEventId).toBe(`gcal_mock_${sampleRequest.referenceNumber}`);
      expect(result.isMock).toBe(true);
    });

    it('should prioritize hangoutLink from Google Calendar when available', async () => {
      const mockHangoutLink = 'https://meet.google.com/abc-defg-hij';
      (service as any).isConfigured = true;
      (service as any).calendar = {
        events: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: 'gcal_live_event_123',
              hangoutLink: mockHangoutLink,
              htmlLink: 'https://calendar.google.com/event?eid=123',
            },
          }),
        },
      };

      const result = await service.createConsultationMeeting(sampleRequest);

      expect(result.meetingLink).toBe(mockHangoutLink);
      expect(result.googleCalendarEventId).toBe('gcal_live_event_123');
      expect(result.isMock).toBe(false);
    });

    it('should fallback to valid meeting URL if insert fails or returns no hangoutLink', async () => {
      (service as any).isConfigured = true;
      (service as any).calendar = {
        events: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: 'gcal_live_event_456',
              htmlLink: 'https://calendar.google.com/event?eid=456',
            },
          }),
        },
      };

      const result = await service.createConsultationMeeting(sampleRequest);

      expect(result.meetingLink).toMatch(/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
      expect(result.googleCalendarEventId).toBe('gcal_live_event_456');
    });
  });

  describe('updateConsultationMeeting and cancelConsultationMeeting', () => {
    it('should update consultation meeting times via patch', async () => {
      (service as any).isConfigured = true;
      (service as any).calendar = {
        events: {
          patch: jest.fn().mockResolvedValue({ data: { id: 'evt-123' } }),
          delete: jest.fn().mockResolvedValue({ data: {} }),
        },
      };

      const updated = await service.updateConsultationMeeting(
        'evt-123',
        '2026-11-16',
        '14:00',
        '15:00'
      );
      expect(updated).toBe(true);
      expect((service as any).calendar.events.patch).toHaveBeenCalled();

      const cancelled = await service.cancelConsultationMeeting('evt-123');
      expect(cancelled).toBe(true);
      expect((service as any).calendar.events.delete).toHaveBeenCalled();
    });

    it('should ignore mock event IDs safely without throwing', async () => {
      const updated = await service.updateConsultationMeeting(
        'gcal_mock_test',
        '2026-11-16',
        '14:00',
        '15:00'
      );
      expect(updated).toBe(true);

      const cancelled = await service.cancelConsultationMeeting('gcal_mock_test');
      expect(cancelled).toBe(true);
    });
  });

  describe('getAttorneyBusyIntervals', () => {
    it('should return empty array for mock or empty refresh tokens', async () => {
      const busy = await service.getAttorneyBusyIntervals(
        'mock-token',
        new Date(),
        new Date()
      );
      expect(busy).toEqual([]);
    });
  });
});
