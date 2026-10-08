import { Test, TestingModule } from '@nestjs/testing';
import { BookingCheckoutService } from './booking-checkout.service';
import { PrismaService } from '../../../database/prisma.service';
import { UserServiceClient } from '../../../integrations/user-service.client';
import { FinancialServiceClient } from '../../../integrations/financial-service.client';
import { BookingStatus, PaymentStatus } from '@prisma/client/marketplace';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('BookingCheckoutService', () => {
  let service: BookingCheckoutService;
  let mockPrisma: any;
  let mockUserServiceClient: any;
  let mockFinancialServiceClient: any;

  beforeEach(async () => {
    mockPrisma = {
      booking: {
        findUnique: jest.fn(),
      },
    };

    mockUserServiceClient = {
      getAttorneyProfile: jest.fn(),
      getUserProfile: jest.fn(),
    };

    mockFinancialServiceClient = {
      createPayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCheckoutService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserServiceClient, useValue: mockUserServiceClient },
        { provide: FinancialServiceClient, useValue: mockFinancialServiceClient },
      ],
    }).compile();

    service = module.get<BookingCheckoutService>(BookingCheckoutService);
  });

  it('should successfully initiate checkout with zero-payload and server-resolved fee', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'bk-123',
      referenceNumber: 'CONS-2026-000042',
      clientId: 'client-abc',
      attorneyId: 'att-xyz',
      status: BookingStatus.ACCEPTED_PENDING_PAYMENT,
      paymentStatus: PaymentStatus.UNPAID,
    });

    mockUserServiceClient.getAttorneyProfile.mockResolvedValue({
      id: 'prof-xyz',
      consultationFee: 2500.0,
      feeBand: 'PREMIUM',
    });

    mockUserServiceClient.getUserProfile.mockResolvedValue({
      id: 'client-abc',
      email: 'client@example.com',
      phone: '+251911223344',
    });

    mockFinancialServiceClient.createPayment.mockResolvedValue({
      id: 'pay-001',
      transactionReference: 'TX-12345678',
      amount: 2500.0,
      currency: 'ETB',
      provider: 'CHAPA',
      status: 'PENDING',
      checkoutUrl: 'https://checkout.chapa.co/checkout/payment/123456',
    });

    const result = await service.initiateCheckout(
      'bk-123',
      'client-abc',
      'client@example.com',
      {}, // Empty body
    );

    expect(result.success).toBe(true);
    expect(result.amount).toBe(2500.0);
    expect(result.currency).toBe('ETB');
    expect(result.checkoutUrl).toBe('https://checkout.chapa.co/checkout/payment/123456');

    expect(mockFinancialServiceClient.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'bk-123',
        payerId: 'client-abc',
        payeeId: 'att-xyz',
        amount: 2500.0,
        email: 'client@example.com',
        phone: '+251911223344',
      }),
      undefined,
    );
  });

  it('should throw ForbiddenException if authenticated user is not the booking client', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'bk-123',
      clientId: 'client-abc',
      attorneyId: 'att-xyz',
      status: BookingStatus.ACCEPTED_PENDING_PAYMENT,
      paymentStatus: PaymentStatus.UNPAID,
    });

    await expect(
      service.initiateCheckout('bk-123', 'intruder-client', 'intruder@test.com', {}),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException if booking is not in ACCEPTED_PENDING_PAYMENT status', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'bk-123',
      clientId: 'client-abc',
      attorneyId: 'att-xyz',
      status: BookingStatus.REQUESTED, // Not accepted yet
      paymentStatus: PaymentStatus.UNPAID,
    });

    await expect(
      service.initiateCheckout('bk-123', 'client-abc', 'client@example.com', {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if booking is already PAID', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'bk-123',
      clientId: 'client-abc',
      attorneyId: 'att-xyz',
      status: BookingStatus.ACCEPTED_PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PAID,
    });

    await expect(
      service.initiateCheckout('bk-123', 'client-abc', 'client@example.com', {}),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if attorney has not configured a valid consultation fee', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'bk-123',
      clientId: 'client-abc',
      attorneyId: 'att-xyz',
      status: BookingStatus.ACCEPTED_PENDING_PAYMENT,
      paymentStatus: PaymentStatus.UNPAID,
    });

    mockUserServiceClient.getAttorneyProfile.mockResolvedValue({
      id: 'prof-xyz',
      consultationFee: 0, // Unconfigured
    });

    await expect(
      service.initiateCheckout('bk-123', 'client-abc', 'client@example.com', {}),
    ).rejects.toThrow(BadRequestException);
  });
});
