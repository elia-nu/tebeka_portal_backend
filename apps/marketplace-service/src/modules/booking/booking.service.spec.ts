import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { PrismaService } from '../../database/prisma.service';
import { BookingCancellationService } from './services/booking-cancellation.service';
import { BookingRescheduleService } from './services/booking-reschedule.service';
import { BookingDisputeService } from './services/booking-dispute.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client/marketplace';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingCancellationService, useValue: {} },
        { provide: BookingRescheduleService, useValue: {} },
        { provide: BookingDisputeService, useValue: {} },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBooking validation', () => {
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
});
