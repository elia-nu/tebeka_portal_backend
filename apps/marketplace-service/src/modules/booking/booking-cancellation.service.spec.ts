import { Test, TestingModule } from '@nestjs/testing';
import { BookingCancellationService } from './services/booking-cancellation.service';
import { PrismaService } from '../../database/prisma.service';
import { BookingStatus } from '@prisma/client/marketplace';

describe('BookingCancellationService (FR-BOOK-03 / OQ#1/2 Refund Policy)', () => {
  let service: BookingCancellationService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      booking: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({ status: data.status })),
      },
      bookingEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'out-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCancellationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BookingCancellationService>(BookingCancellationService);
  });

  it('TC-BOOK-02: Client cancels >= 24h prior to slot -> 100% full refund', async () => {
    // Appointment 48 hours in the future
    const appointmentDate = new Date(Date.now() + 48 * 3600 * 1000);
    const dateStr = appointmentDate.toISOString().split('T')[0];

    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1',
      clientId: 'client-1',
      attorneyId: 'att-1',
      bookingDate: dateStr,
      startTime: '10:00',
      status: BookingStatus.CONFIRMED,
      referenceNumber: 'CONS-2026-000001',
    });

    const result = await service.cancelBooking('bk-1', 'client-1', 'Client schedule change');

    expect(result.policyVersion).toBe('v3.0-OQ1/2');
    expect(result.cancelledByRole).toBe('CLIENT');
    expect(result.refundTier).toBe('FULL_24H_PRIOR');
    expect(result.refundAmountSantim).toBe(BigInt(150000));

    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          policyVersion: 'v3.0-OQ1/2',
          cancelledByRole: 'CLIENT',
          refundPercentage: 100,
          refundPolicyTier: 'FULL_24H_PRIOR',
          refundAmountSantim: '150000',
          isAttorneyCancelling: false,
        }),
      }),
    });
  });

  it('TC-BOOK-02 (Partial): Client cancels < 24h prior to slot -> 50% partial refund', async () => {
    // Appointment 6 hours in the future
    const appointmentDate = new Date(Date.now() + 6 * 3600 * 1000);
    const dateStr = appointmentDate.toISOString().split('T')[0];

    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'bk-2',
      clientId: 'client-1',
      attorneyId: 'att-1',
      bookingDate: dateStr,
      startTime: '14:00',
      status: BookingStatus.CONFIRMED,
      referenceNumber: 'CONS-2026-000002',
    });

    const result = await service.cancelBooking('bk-2', 'client-1', 'Short notice cancellation');

    expect(result.policyVersion).toBe('v3.0-OQ1/2');
    expect(result.cancelledByRole).toBe('CLIENT');
    expect(result.refundTier).toBe('PARTIAL_UNDER_24H');
    expect(result.refundAmountSantim).toBe(BigInt(75000));

    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          policyVersion: 'v3.0-OQ1/2',
          cancelledByRole: 'CLIENT',
          refundPercentage: 50,
          refundPolicyTier: 'PARTIAL_UNDER_24H',
          refundAmountSantim: '75000',
          isAttorneyCancelling: false,
        }),
      }),
    });
  });

  it('TC-BOOK-03: Attorney cancels at any time -> 100% full refund + reliability tracking', async () => {
    // Appointment 2 hours in the future
    const appointmentDate = new Date(Date.now() + 2 * 3600 * 1000);
    const dateStr = appointmentDate.toISOString().split('T')[0];

    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'bk-3',
      clientId: 'client-1',
      attorneyId: 'att-1',
      bookingDate: dateStr,
      startTime: '16:00',
      status: BookingStatus.CONFIRMED,
      referenceNumber: 'CONS-2026-000003',
    });

    const result = await service.cancelBooking('bk-3', 'att-1', 'Court emergency');

    expect(result.policyVersion).toBe('v3.0-OQ1/2');
    expect(result.cancelledByRole).toBe('ATTORNEY');
    expect(result.refundTier).toBe('ATTORNEY_FULL_REFUND');
    expect(result.refundAmountSantim).toBe(BigInt(150000));

    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          policyVersion: 'v3.0-OQ1/2',
          cancelledByRole: 'ATTORNEY',
          refundPercentage: 100,
          refundPolicyTier: 'ATTORNEY_FULL_REFUND',
          refundAmountSantim: '150000',
          isAttorneyCancelling: true,
        }),
      }),
    });
  });
});
