import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client/marketplace';
import { PrismaService } from '../../../database/prisma.service';
import { UserServiceClient } from '../../../integrations/user-service.client';
import { FinancialServiceClient } from '../../../integrations/financial-service.client';
import { BookingCheckoutDto } from '../dto/booking-checkout.dto';

@Injectable()
export class BookingCheckoutService {
  private readonly logger = new Logger(BookingCheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userServiceClient: UserServiceClient,
    private readonly financialServiceClient: FinancialServiceClient,
  ) {}

  async initiateCheckout(
    bookingId: string,
    clientId: string,
    jwtEmail?: string,
    dto: BookingCheckoutDto = {},
    correlationId?: string,
  ) {
    // 1. Fetch Booking from marketplace_db
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    // 2. Ownership Guard
    if (booking.clientId !== clientId) {
      throw new ForbiddenException('You are not authorized to initiate checkout for this booking');
    }

    // 3. State Machine Guards
    if (booking.status !== BookingStatus.ACCEPTED_PENDING_PAYMENT) {
      throw new BadRequestException(
        `Booking is in '${booking.status}' status. Only bookings in 'ACCEPTED_PENDING_PAYMENT' status can be checked out.`
      );
    }

    if (booking.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('This consultation has already been paid for.');
    }

    // 4. Authoritative Consultation Fee Resolution from user-service
    let consultationFee = 0;
    let attorneyProfile: any = null;

    try {
      attorneyProfile = await this.userServiceClient.getAttorneyProfile(booking.attorneyId, correlationId);
    } catch (err: any) {
      this.logger.error(`Failed to fetch attorney profile for ${booking.attorneyId}: ${err.message}`);
    }

    if (attorneyProfile) {
      consultationFee = Number(attorneyProfile.consultationFee || attorneyProfile.consultationFees || 0);
    }

    if (consultationFee <= 0) {
      throw new BadRequestException('Attorney has not configured a valid consultation fee');
    }

    // 5. Contact Info Resolution (DTO > JWT > User Profile)
    let email = dto.email || jwtEmail;
    let phone = dto.phone;

    if (!phone || !email) {
      try {
        const userProfile = await this.userServiceClient.getUserProfile(clientId, correlationId);
        if (userProfile) {
          if (!phone) phone = userProfile.phone || userProfile.phoneNumber;
          if (!email) email = userProfile.email;
        }
      } catch (err: any) {
        this.logger.warn(`Could not resolve client user profile for ${clientId}: ${err.message}`);
      }
    }

    // 6. Invoke Financial Service internal payment creation
    const paymentResponse = await this.financialServiceClient.createPayment(
      {
        bookingId: booking.id,
        payerId: clientId,
        payeeId: booking.attorneyId,
        paymentType: 'CONSULTATION_ONE_TIME',
        amount: consultationFee,
        currency: 'ETB',
        provider: dto.provider,
        email: email || undefined,
        phone: phone || undefined,
        description: `Consultation Booking: ${booking.referenceNumber || booking.id}`,
      },
      correlationId,
    );

    this.logger.log(
      `Checkout session created for booking [${booking.id}]. Reference: ${paymentResponse?.transactionReference}, Provider: ${paymentResponse?.provider}`
    );

    return {
      success: true,
      bookingId: booking.id,
      referenceNumber: booking.referenceNumber,
      consultationFee,
      amount: consultationFee,
      currency: paymentResponse?.currency || 'ETB',
      provider: paymentResponse?.provider || dto.provider || 'CHAPA',
      transactionReference: paymentResponse?.transactionReference,
      checkoutUrl: paymentResponse?.checkoutUrl || null,
      status: paymentResponse?.status || 'PENDING',
    };
  }
}
