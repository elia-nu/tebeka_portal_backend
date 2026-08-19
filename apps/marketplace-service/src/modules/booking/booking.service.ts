import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { PrismaClient, BookingStatus, ConsultationType } from '@prisma/client/marketplace';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';
import { GoogleMeetService } from '../integrations/google-meet.service';

const prisma = new PrismaClient();

@Injectable()
export class BookingService {
  constructor(
    @Optional() private readonly communicationServiceClient?: CommunicationServiceClient,
    @Optional() private readonly googleMeetService?: GoogleMeetService
  ) {}

  async createBooking(data: any, clientId: string) {
    if (!data.attorneyId) throw new BadRequestException('attorneyId is required');
    if (!data.bookingDate) throw new BadRequestException('bookingDate is required');
    if (!data.startTime || !data.endTime) throw new BadRequestException('startTime and endTime are required');

    const bookingDate = new Date(data.bookingDate);

    // Double booking conflict prevention inside Interactive Transaction
    return prisma.$transaction(async (tx) => {
      const existingOverlapping = await tx.booking.findFirst({
        where: {
          attorneyId: data.attorneyId,
          bookingDate,
          startTime: data.startTime,
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACCEPTED_PENDING_PAYMENT] },
        },
      });

      if (existingOverlapping) {
        throw new ConflictException({
          code: 'BOOKING_SLOT_CONFLICT',
          message: 'The selected time slot is already booked or accepted pending payment.',
        });
      }

      const bookingCount = await tx.booking.count();
      const referenceNumber = `CONS-${new Date().getFullYear()}-${String(bookingCount + 1).padStart(6, '0')}`;

      const booking = await tx.booking.create({
        data: {
          referenceNumber,
          clientId,
          attorneyId: data.attorneyId,
          availabilityId: data.availabilityId || null,
          bookingDate,
          startTime: data.startTime,
          endTime: data.endTime,
          consultationType: data.consultationType || ConsultationType.VIDEO,
          status: BookingStatus.REQUESTED,
          paymentStatus: data.paymentStatus || 'UNPAID',
          meetingLink: data.meetingLink || null,
          issueBrief: data.issueBrief || data.notes || null,
          notes: data.notes || null,
          bookingEvents: {
            create: {
              event: 'BOOKING_REQUESTED',
              description: `Booking requested with reference ${referenceNumber} by client ${clientId}`,
              createdBy: clientId,
            },
          },
          bookingTimelines: {
            create: {
              title: 'Consultation Requested',
              description: `Consultation requested with reference ${referenceNumber}`,
              eventDate: new Date(),
            },
          },
        },
      });

      // Write event to Outbox table
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: booking.id,
          eventType: 'BOOKING_REQUESTED',
          payload: {
            bookingId: booking.id,
            clientId,
            attorneyId: data.attorneyId,
            bookingDate: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
          },
        },
      });

      return booking;
    });
  }

  async acceptBooking(id: string, attorneyId: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.attorneyId !== attorneyId) {
        throw new ForbiddenException('You can only accept bookings requested for you');
      }

      if (booking.status !== BookingStatus.REQUESTED) {
        throw new BadRequestException(`Cannot accept booking in ${booking.status} status`);
      }

      const updated = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.ACCEPTED_PENDING_PAYMENT },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'BOOKING_ACCEPTED',
          description: `Booking request accepted by attorney ${attorneyId}. Pending client payment.`,
          createdBy: attorneyId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: 'BOOKING_ACCEPTED',
          payload: {
            bookingId: id,
            clientId: booking.clientId,
            attorneyId: booking.attorneyId,
            status: BookingStatus.ACCEPTED_PENDING_PAYMENT,
          },
        },
      });

      return updated;
    });
  }

  async declineBooking(id: string, attorneyId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.attorneyId !== attorneyId) {
        throw new ForbiddenException('You can only decline bookings requested for you');
      }

      if (booking.status !== BookingStatus.REQUESTED) {
        throw new BadRequestException(`Cannot decline booking in ${booking.status} status`);
      }

      const updated = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.DECLINED },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'BOOKING_DECLINED',
          description: reason || `Booking request declined by attorney ${attorneyId}`,
          createdBy: attorneyId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: 'BOOKING_DECLINED',
          payload: {
            bookingId: id,
            clientId: booking.clientId,
            attorneyId: booking.attorneyId,
            reason,
            status: BookingStatus.DECLINED,
          },
        },
      });

      return updated;
    });
  }

  async findUserBookings(userId: string, role: string, query: any) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};

    // Ownership or admin filter
    if (role === 'ATTORNEY') {
      where.attorneyId = userId;
    } else if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      where.clientId = userId;
    }

    // Model-driven filters
    if (query.clientId) where.clientId = query.clientId;
    if (query.attorneyId) where.attorneyId = query.attorneyId;
    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.consultationType) where.consultationType = query.consultationType;

    if (query.fromDate || query.toDate) {
      where.bookingDate = {};
      if (query.fromDate) where.bookingDate.gte = new Date(query.fromDate);
      if (query.toDate) where.bookingDate.lte = new Date(query.toDate);
    }

    // Dynamic sorting
    const allowedSortFields = ['bookingDate', 'createdAt', 'status', 'paymentStatus'];
    const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'bookingDate';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: { bookingEvents: true, case: true, review: true },
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.booking.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { bookingEvents: true, case: true, review: true },
    });
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    return booking;
  }

  async updateBookingStatus(id: string, newStatus: BookingStatus, userId: string, reason?: string) {
    // Interactive Transaction: Fetching current state and updating inside transaction client tx
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        throw new NotFoundException(`Booking ${id} not found`);
      }

      const updated = await tx.booking.update({
        where: { id },
        data: { status: newStatus },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: `BOOKING_${newStatus}`,
          description: reason || `Booking status updated to ${newStatus}`,
          createdBy: userId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: `BOOKING_${newStatus}`,
          payload: {
            bookingId: id,
            status: newStatus,
            clientId: booking.clientId,
            attorneyId: booking.attorneyId,
            reason,
          },
        },
      });

      return updated;
    });
  }

  async cancelBooking(id: string, userId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('Booking is already cancelled');
      }

      if (booking.status === BookingStatus.COMPLETED) {
        throw new BadRequestException('Cannot cancel a completed consultation');
      }

      // Tiered cancellation & refund policy calculation (BR-BOOK-03)
      const dateStr = typeof booking.bookingDate === 'string'
        ? (booking.bookingDate as string).split('T')[0]
        : booking.bookingDate.toISOString().split('T')[0];
      const appointmentDateTime = new Date(`${dateStr}T${booking.startTime}:00`);
      const hoursUntilAppointment = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

      let refundPercentage = 0;
      let refundPolicyTier = 'NONE';
      const isAttorneyCancelling = userId === booking.attorneyId;

      if (isAttorneyCancelling) {
        // If attorney cancels, client receives 100% full refund
        refundPercentage = 100;
        refundPolicyTier = 'ATTORNEY_FULL_REFUND';
      } else {
        // Client tiered cancellation policy
        if (hoursUntilAppointment >= 24) {
          refundPercentage = 100;
          refundPolicyTier = 'FULL_24H_PRIOR';
        } else if (hoursUntilAppointment >= 12) {
          refundPercentage = 50;
          refundPolicyTier = 'PARTIAL_12H_TO_24H';
        } else {
          refundPercentage = 0;
          refundPolicyTier = 'LATE_LESS_THAN_12H';
        }
      }

      const updated = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'BOOKING_CANCELLED',
          description: reason || `Cancelled by ${isAttorneyCancelling ? 'Attorney' : 'Client'} (Refund: ${refundPercentage}% - Policy: ${refundPolicyTier})`,
          createdBy: userId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: 'BOOKING_CANCELLED',
          payload: {
            bookingId: id,
            referenceNumber: booking.referenceNumber,
            clientId: booking.clientId,
            attorneyId: booking.attorneyId,
            cancelledBy: userId,
            isAttorneyCancelling,
            refundPercentage,
            refundPolicyTier,
            reason: reason || 'Cancelled by user',
          },
        },
      });

      // Cancel Google Calendar & Meet event
      if (booking.googleCalendarEventId && this.googleMeetService) {
        setImmediate(() => {
          this.googleMeetService?.cancelConsultationMeeting(booking.googleCalendarEventId!);
        });
      }

      return {
        ...updated,
        refundPercentage,
        refundPolicyTier,
      };
    });
  }

  async rescheduleBooking(id: string, data: { bookingDate: string; startTime: string; endTime: string }, userId: string) {
    const bookingDate = new Date(data.bookingDate);

    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        throw new NotFoundException(`Booking ${id} not found`);
      }

      const conflict = await tx.booking.findFirst({
        where: {
          attorneyId: booking.attorneyId,
          bookingDate,
          startTime: data.startTime,
          id: { not: id },
          status: { in: [BookingStatus.ACCEPTED_PENDING_PAYMENT, BookingStatus.CONFIRMED] },
        },
      });

      if (conflict) {
        throw new ConflictException('The requested reschedule time slot is unavailable.');
      }

      const updated = await tx.booking.update({
        where: { id },
        data: {
          bookingDate,
          startTime: data.startTime,
          endTime: data.endTime,
          status: BookingStatus.ACCEPTED_PENDING_PAYMENT,
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'BOOKING_RESCHEDULED',
          description: `Rescheduled to ${data.bookingDate} ${data.startTime}`,
          createdBy: userId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: 'BOOKING_RESCHEDULED',
          payload: { bookingId: id, newBookingDate: data.bookingDate, newStartTime: data.startTime },
        },
      });

      return updated;
    });
  }

  async proposeReschedule(
    id: string,
    data: { proposedBookingDate: string; proposedStartTime: string; proposedEndTime: string; reason?: string },
    userId: string
  ) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.rescheduleCount >= 2) {
        throw new BadRequestException('Maximum limit of 2 reschedules reached for this booking (BR-BOOK-04)');
      }

      if (
        booking.status !== BookingStatus.CONFIRMED &&
        booking.status !== BookingStatus.ACCEPTED_PENDING_PAYMENT &&
        booking.status !== BookingStatus.REQUESTED
      ) {
        throw new BadRequestException(`Cannot propose reschedule for booking in status ${booking.status}`);
      }

      const proposedDate = new Date(data.proposedBookingDate);
      const conflict = await tx.booking.findFirst({
        where: {
          attorneyId: booking.attorneyId,
          bookingDate: proposedDate,
          startTime: data.proposedStartTime,
          id: { not: id },
          status: { in: [BookingStatus.ACCEPTED_PENDING_PAYMENT, BookingStatus.CONFIRMED] },
        },
      });

      if (conflict) {
        throw new ConflictException('The proposed reschedule time slot is unavailable.');
      }

      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12-hour acceptance window (BR-BOOK-04)

      const updated = await tx.booking.update({
        where: { id },
        data: {
          rescheduleProposedBy: userId,
          proposedBookingDate: proposedDate,
          proposedStartTime: data.proposedStartTime,
          proposedEndTime: data.proposedEndTime,
          rescheduleExpiresAt: expiresAt,
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'RESCHEDULE_PROPOSED',
          description: data.reason || `Reschedule proposed for ${data.proposedBookingDate} ${data.proposedStartTime} (expires in 12h)`,
          createdBy: userId,
        },
      });

      return updated;
    });
  }

  async respondToReschedule(id: string, data: { action: 'ACCEPT' | 'REJECT'; reason?: string }, userId: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (!booking.proposedBookingDate) {
        throw new BadRequestException('No active reschedule proposal exists for this booking');
      }

      if (booking.rescheduleExpiresAt && booking.rescheduleExpiresAt < new Date()) {
        await tx.booking.update({
          where: { id },
          data: {
            rescheduleProposedBy: null,
            proposedBookingDate: null,
            proposedStartTime: null,
            proposedEndTime: null,
            rescheduleExpiresAt: null,
          },
        });
        throw new BadRequestException('Reschedule proposal has expired after 12 hours. Original slot remains (BR-BOOK-04).');
      }

      if (data.action === 'ACCEPT') {
        const updated = await tx.booking.update({
          where: { id },
          data: {
            bookingDate: booking.proposedBookingDate,
            startTime: booking.proposedStartTime!,
            endTime: booking.proposedEndTime!,
            rescheduleCount: booking.rescheduleCount + 1,
            rescheduleProposedBy: null,
            proposedBookingDate: null,
            proposedStartTime: null,
            proposedEndTime: null,
            rescheduleExpiresAt: null,
            status: BookingStatus.CONFIRMED,
          },
        });

        await tx.bookingEvent.create({
          data: {
            bookingId: id,
            event: 'RESCHEDULE_ACCEPTED',
            description: `Reschedule accepted for ${booking.proposedBookingDate} ${booking.proposedStartTime}`,
            createdBy: userId,
          },
        });

        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Booking',
            aggregateId: id,
            eventType: 'BOOKING_RESCHEDULED',
            payload: {
              bookingId: id,
              referenceNumber: booking.referenceNumber,
              clientId: booking.clientId,
              attorneyId: booking.attorneyId,
              newBookingDate: booking.proposedBookingDate,
              newStartTime: booking.proposedStartTime,
              newEndTime: booking.proposedEndTime,
              rescheduleCount: booking.rescheduleCount + 1,
            },
          },
        });

        // Sync new schedule to Google Calendar & Meet
        if (booking.googleCalendarEventId && this.googleMeetService) {
          setImmediate(() => {
            this.googleMeetService?.updateConsultationMeeting(
              booking.googleCalendarEventId!,
              booking.proposedBookingDate!,
              booking.proposedStartTime!,
              booking.proposedEndTime!
            );
          });
        }

        return updated;
      } else {
        const updated = await tx.booking.update({
          where: { id },
          data: {
            rescheduleProposedBy: null,
            proposedBookingDate: null,
            proposedStartTime: null,
            proposedEndTime: null,
            rescheduleExpiresAt: null,
          },
        });

        await tx.bookingEvent.create({
          data: {
            bookingId: id,
            event: 'RESCHEDULE_REJECTED',
            description: data.reason || 'Reschedule proposal rejected. Original appointment remains.',
            createdBy: userId,
          },
        });

        return updated;
      }
    });
  }

  async reportNoShow(id: string, userId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new BadRequestException(`Cannot mark booking in ${booking.status} status as No-Show.`);
      }

      const isClientReporting = userId === booking.clientId;
      const faultParty = isClientReporting ? 'ATTORNEY' : 'CLIENT';
      const refundPercentage = isClientReporting ? 100 : 0; // Attorney no-show -> 100% refund; Client no-show -> 0% refund

      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.NOSHOW,
          noShowReportedBy: userId,
          noShowReason: reason || `No-show reported by ${isClientReporting ? 'Client' : 'Attorney'}`,
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'BOOKING_NOSHOW',
          description: reason || `Marked as No-Show. Fault Party: ${faultParty} (Refund: ${refundPercentage}%)`,
          createdBy: userId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: 'BOOKING_NOSHOW',
          payload: {
            bookingId: id,
            referenceNumber: booking.referenceNumber,
            clientId: booking.clientId,
            attorneyId: booking.attorneyId,
            reportedBy: userId,
            faultParty,
            refundPercentage,
            reason: reason || 'Participant failed to attend scheduled consultation',
          },
        },
      });

      return {
        ...updated,
        faultParty,
        refundPercentage,
      };
    });
  }

  async createBlackout(attorneyId: string, data: { startDate: string; endDate: string; reason?: string }) {
    return prisma.availabilityBlackout.create({
      data: {
        attorneyId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason || 'Vacation / Blackout Period',
      },
    });
  }

  async getBlackouts(attorneyId: string) {
    return prisma.availabilityBlackout.findMany({
      where: { attorneyId },
      orderBy: { startDate: 'asc' },
    });
  }

  async getOrCreateBookingChat(bookingId: string, userId?: string) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    if (this.communicationServiceClient) {
      return this.communicationServiceClient.getOrCreateBookingChat(
        booking.id,
        booking.clientId,
        booking.attorneyId,
        `Consultation - ${booking.referenceNumber || booking.id}`
      );
    }

    return {
      status: 'pending',
      bookingId: booking.id,
      clientId: booking.clientId,
      attorneyId: booking.attorneyId,
      message: 'Chat conversation created/linked with consultation',
    };
  }
}
