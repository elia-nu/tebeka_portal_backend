import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { PrismaService } from '../../database/prisma.service';
import { BookingCancellationService } from './services/booking-cancellation.service';
import { BookingRescheduleService } from './services/booking-reschedule.service';
import { BookingDisputeService } from './services/booking-dispute.service';
import { BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client/marketplace';
import { GoogleMeetService } from '../integrations/google-meet.service';
import { UserServiceClient } from '../../integrations/user-service.client';

describe('BookingService', () => {
  let service: BookingService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      booking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      bookingEvent: {
        create: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    const mockGoogleMeetService = {
      getAttorneyBusyIntervals: jest.fn(),
    };
    const mockUserServiceClient = {
      getAttorneyProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingCancellationService, useValue: {} },
        { provide: BookingRescheduleService, useValue: {} },
        { provide: BookingDisputeService, useValue: {} },
        { provide: GoogleMeetService, useValue: mockGoogleMeetService },
        { provide: UserServiceClient, useValue: mockUserServiceClient },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    (service as any).googleMeetService = mockGoogleMeetService;
    (service as any).userServiceClient = mockUserServiceClient;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBooking validation & Google Calendar Strict Checks', () => {
    it('should throw BadRequestException if attorneyId is missing', async () => {
      await expect(service.createBooking({}, 'client-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if bookingDate is missing', async () => {
      await expect(service.createBooking({ attorneyId: 'att-1' }, 'client-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if times are missing', async () => {
      await expect(
        service.createBooking({ attorneyId: 'att-1', bookingDate: '2026-10-01' }, 'client-1')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException (GOOGLE_CALENDAR_BUSY) if slot collides with Google Calendar busy block', async () => {
      const mockUserServiceClient = (service as any).userServiceClient;
      const mockGoogleMeetService = (service as any).googleMeetService;

      mockUserServiceClient.getAttorneyProfile.mockResolvedValue({
        id: 'att-1',
        isGoogleSyncEnabled: true,
        googleRefreshToken: 'valid-refresh-token',
        googleCalendarId: 'primary',
      });

      mockGoogleMeetService.getAttorneyBusyIntervals.mockResolvedValue([
        {
          start: new Date('2026-10-07T08:00:00.000Z'), // 11:00 EAT
          end: new Date('2026-10-07T09:00:00.000Z'),   // 12:00 EAT
        },
      ]);

      await expect(
        service.createBooking(
          {
            attorneyId: 'att-1',
            bookingDate: '2026-10-07',
            startTime: '11:00',
            endTime: '12:00',
          },
          'client-1'
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('declineBooking', () => {
    it('should throw NotFoundException if booking does not exist', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);
      await expect(service.declineBooking('non-existent', 'att-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if attorneyId does not match booking attorneyId', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        attorneyId: 'different-attorney',
        status: BookingStatus.REQUESTED,
      });

      await expect(service.declineBooking('book-1', 'att-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if booking is not in REQUESTED status', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        attorneyId: 'att-1',
        status: BookingStatus.CONFIRMED,
      });

      await expect(service.declineBooking('book-1', 'att-1')).rejects.toThrow(BadRequestException);
    });

    it('should transition status to DECLINED and create events', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        attorneyId: 'att-1',
        clientId: 'cli-1',
        status: BookingStatus.REQUESTED,
      });
      mockPrisma.booking.update.mockResolvedValue({
        id: 'book-1',
        status: BookingStatus.DECLINED,
      });

      const result = await service.declineBooking('book-1', 'att-1', 'Scheduling conflict');
      expect(result.status).toBe(BookingStatus.DECLINED);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: { status: BookingStatus.DECLINED },
      });
      expect(mockPrisma.bookingEvent.create).toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalled();
    });
  });

  describe('getAvailableSlotsForDate (FR-BOOK-01 / Fallback Removal, Timezone & Google Calendar Restrictions)', () => {
    it('should throw BadRequestException if date format is invalid', async () => {
      await expect(service.getAvailableSlotsForDate('att-1', 'invalid-date')).rejects.toThrow(BadRequestException);
    });

    it('should return isAvailable=false when attorney has no availability window configured in DB (No Fallback)', async () => {
      mockPrisma.availabilityBlackout = { findFirst: jest.fn().mockResolvedValue(null) };
      mockPrisma.availabilityWindow = { findFirst: jest.fn().mockResolvedValue(null) };

      // 2026-10-07 is a Wednesday (weekday: 3)
      const result = await service.getAvailableSlotsForDate('att-1', '2026-10-07');
      expect(result.isAvailable).toBe(false);
      expect(result.availableSlots).toEqual([]);
      expect(result.reason).toBe('Attorney does not have working hours configured for this day');
      expect(mockPrisma.availabilityWindow.findFirst).toHaveBeenCalledWith({
        where: {
          attorneyId: 'att-1',
          weekday: 3,
          isAvailable: true,
        },
      });
    });

    it('should return slots when availability window exists for Wednesday (2026-10-07 / weekday: 3)', async () => {
      mockPrisma.availabilityBlackout = { findFirst: jest.fn().mockResolvedValue(null) };
      mockPrisma.availabilityWindow = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'win-1',
          attorneyId: 'att-1',
          weekday: 3,
          startTime: '10:00',
          endTime: '13:00',
          isAvailable: true,
        }),
      };
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlotsForDate('att-1', '2026-10-07', 60);
      expect(result.isAvailable).toBe(true);
      expect(result.availableSlots).toEqual([
        { startTime: '10:00', endTime: '11:00' },
        { startTime: '11:00', endTime: '12:00' },
        { startTime: '12:00', endTime: '13:00' },
      ]);
    });

    it('should strictly filter out slots that conflict with Google Calendar busy events', async () => {
      mockPrisma.availabilityBlackout = { findFirst: jest.fn().mockResolvedValue(null) };
      mockPrisma.availabilityWindow = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'win-1',
          attorneyId: 'att-1',
          weekday: 3,
          startTime: '10:00',
          endTime: '13:00',
          isAvailable: true,
        }),
      };
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const mockUserServiceClient = (service as any).userServiceClient;
      const mockGoogleMeetService = (service as any).googleMeetService;

      mockUserServiceClient.getAttorneyProfile.mockResolvedValue({
        id: 'att-1',
        isGoogleSyncEnabled: true,
        googleRefreshToken: 'valid-token',
      });

      // 11:00 - 12:00 EAT is busy in Google Calendar
      mockGoogleMeetService.getAttorneyBusyIntervals.mockResolvedValue([
        {
          start: new Date('2026-10-07T08:00:00.000Z'), // 11:00 EAT
          end: new Date('2026-10-07T09:00:00.000Z'),   // 12:00 EAT
        },
      ]);

      const result = await service.getAvailableSlotsForDate('att-1', '2026-10-07', 60);
      expect(result.isAvailable).toBe(true);
      expect(result.isGoogleSyncActive).toBe(true);
      expect(result.availableSlotsCount).toBe(2);
      // 11:00-12:00 slot is strictly omitted because attorney is busy on Google Calendar
      expect(result.availableSlots).toEqual([
        { startTime: '10:00', endTime: '11:00' },
        { startTime: '12:00', endTime: '13:00' },
      ]);
    });

    it('should return isAvailable=false when date is within an availability blackout', async () => {
      mockPrisma.availabilityBlackout = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'blk-1',
          attorneyId: 'att-1',
          reason: 'Annual Vacation',
        }),
      };

      const result = await service.getAvailableSlotsForDate('att-1', '2026-10-07');
      expect(result.isAvailable).toBe(false);
      expect(result.availableSlots).toEqual([]);
      expect(result.reason).toBe('Annual Vacation');
    });
  });
});


