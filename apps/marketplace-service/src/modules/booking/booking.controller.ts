import { Controller, Get, Post, Patch, Body, Param, Query, Req, UsePipes, UseGuards, Headers } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Public } from '@workspace/auth';
import { BookingService } from './booking.service';
import { BookingCheckoutService } from './services/booking-checkout.service';
import {
  CreateBookingDto,
  CreateBookingSchema,
  UpdateBookingStatusDto,
  UpdateBookingStatusSchema,
  RescheduleBookingDto,
  RescheduleBookingSchema,
  QueryBookingDto,
  QueryBookingSchema,
} from './dto/booking.dto';
import { BookingCheckoutDto, BookingCheckoutSchema } from './dto/booking-checkout.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly bookingCheckoutService: BookingCheckoutService,
  ) {}

  @Post()
  @UsePipes(new JoiValidationPipe(CreateBookingSchema))
  async createBooking(
    @Body() body: CreateBookingDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const clientId = req.user?.id || body.clientId;
    return this.bookingService.createBooking(body, clientId, correlationId);
  }

  @Get()
  @UsePipes(new JoiValidationPipe(QueryBookingSchema))
  async findUserBookings(
    @Query() query: QueryBookingDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const userId = req.user.id;
    const role = req.user.role || query.role || 'CLIENT';
    return this.bookingService.findUserBookings(userId, role, query, correlationId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.bookingService.findOne(id, correlationId);
  }

  @Patch(':id/accept')
  async acceptBooking(@Param('id') id: string, @Req() req: any) {
    const attorneyId = req.user.id;
    return this.bookingService.acceptBooking(id, attorneyId);
  }

  @Post(':id/checkout')
  async checkoutBooking(
    @Param('id') id: string,
    @Body() rawBody: BookingCheckoutDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const body: BookingCheckoutDto = rawBody ? new JoiValidationPipe(BookingCheckoutSchema).transform(rawBody, { type: 'body' }) : {};
    const clientId = req.user?.id || req.user?.userId || req.user?.sub || body?.clientId;
    const jwtEmail = req.user?.email || body?.email;
    const jwtPhone = req.user?.phone || req.user?.phoneNumber || body?.phone;
    return this.bookingCheckoutService.initiateCheckout(id, clientId, jwtEmail, jwtPhone, body, correlationId);
  }

  @Patch(':id/decline')
  async declineBooking(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: any) {
    const attorneyId = req.user.id;
    return this.bookingService.declineBooking(id, attorneyId, body?.reason);
  }

  @Patch(':id/status')
  @UsePipes(new JoiValidationPipe(UpdateBookingStatusSchema))
  async updateStatus(@Param('id') id: string, @Body() body: UpdateBookingStatusDto, @Req() req: any) {
    const userId = req.user.id;
    return this.bookingService.updateBookingStatus(id, body.status, userId, body.reason);
  }

  @Post(':id/cancel')
  async cancelBooking(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: any) {
    const userId = req.user.id;
    return this.bookingService.cancelBooking(id, userId, body.reason);
  }

  @Post(':id/reschedule')
  @UsePipes(new JoiValidationPipe(RescheduleBookingSchema))
  async rescheduleBooking(@Param('id') id: string, @Body() body: RescheduleBookingDto, @Req() req: any) {
    const userId = req.user.id;
    return this.bookingService.rescheduleBooking(id, body, userId);
  }

  @Post(':id/reschedule-proposal')
  async proposeReschedule(
    @Param('id') id: string,
    @Body() body: { proposedBookingDate: string; proposedStartTime: string; proposedEndTime: string; reason?: string },
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.bookingService.proposeReschedule(id, body, userId);
  }

  @Post(':id/reschedule-response')
  async respondToReschedule(
    @Param('id') id: string,
    @Body() body: { action: 'ACCEPT' | 'REJECT'; reason?: string },
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.bookingService.respondToReschedule(id, body, userId);
  }

  @Post(':id/no-show')
  async reportNoShow(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.bookingService.reportNoShow(id, userId, body?.reason);
  }

  @Post('blackouts')
  async createBlackout(
    @Body() body: { attorneyId?: string; startDate: string; endDate: string; reason?: string },
    @Req() req: any
  ) {
    const attorneyId = req.user?.role === 'ADMIN' && body.attorneyId ? body.attorneyId : (req.user?.attorneyProfile?.id || req.user.id);
    return this.bookingService.createBlackout(attorneyId, body);
  }

  @Get('blackouts')
  async getBlackouts(@Query('attorneyId') attorneyId: string, @Req() req: any) {
    const targetAttorneyId = req.user?.role === 'ADMIN' && attorneyId ? attorneyId : (req.user?.attorneyProfile?.id || req.user.id);
    return this.bookingService.getBlackouts(targetAttorneyId);
  }

  @Post(':id/chat')
  async createBookingChat(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.bookingService.getOrCreateBookingChat(id, userId);
  }

  @Get(':id/chat')
  async getBookingChat(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.bookingService.getOrCreateBookingChat(id, userId);
  }

  @Public()
  @Get('attorneys/:attorneyId/available-slots')
  async getAttorneyAvailableSlots(
    @Param('attorneyId') attorneyId: string,
    @Query('date') date: string,
    @Query('duration') duration?: string,
  ) {
    const durationMinutes = duration ? Number(duration) : 60;
    return this.bookingService.getAvailableSlotsForDate(attorneyId, date, durationMinutes);
  }
}
