import { Controller, Get, Post, Patch, Body, Param, Query, Req, UsePipes } from '@nestjs/common';
import { BookingService } from './booking.service';
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
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @UsePipes(new JoiValidationPipe(CreateBookingSchema))
  async createBooking(@Body() body: CreateBookingDto, @Req() req: any) {
    const clientId = req.user?.id || body.clientId;
    return this.bookingService.createBooking(body, clientId);
  }

  @Get()
  @UsePipes(new JoiValidationPipe(QueryBookingSchema))
  async findUserBookings(@Query() query: QueryBookingDto, @Req() req: any) {
    const userId = req.user?.id || query.userId;
    const role = req.user?.role || query.role || 'CLIENT';
    return this.bookingService.findUserBookings(userId, role, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  @Patch(':id/accept')
  async acceptBooking(@Param('id') id: string, @Req() req: any) {
    const attorneyId = req.user?.id || req.body?.attorneyId || 'attorney-1';
    return this.bookingService.acceptBooking(id, attorneyId);
  }

  @Patch(':id/decline')
  async declineBooking(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: any) {
    const attorneyId = req.user?.id || req.body?.attorneyId || 'attorney-1';
    return this.bookingService.declineBooking(id, attorneyId, body?.reason);
  }

  @Patch(':id/status')
  @UsePipes(new JoiValidationPipe(UpdateBookingStatusSchema))
  async updateStatus(@Param('id') id: string, @Body() body: UpdateBookingStatusDto, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.bookingService.updateBookingStatus(id, body.status, userId, body.reason);
  }

  @Post(':id/cancel')
  async cancelBooking(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.bookingService.cancelBooking(id, userId, body.reason);
  }

  @Post(':id/reschedule')
  @UsePipes(new JoiValidationPipe(RescheduleBookingSchema))
  async rescheduleBooking(@Param('id') id: string, @Body() body: RescheduleBookingDto, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.bookingService.rescheduleBooking(id, body, userId);
  }

  @Post(':id/reschedule-proposal')
  async proposeReschedule(
    @Param('id') id: string,
    @Body() body: { proposedBookingDate: string; proposedStartTime: string; proposedEndTime: string; reason?: string },
    @Req() req: any
  ) {
    const userId = req.user?.id || 'client-1';
    return this.bookingService.proposeReschedule(id, body, userId);
  }

  @Post(':id/reschedule-response')
  async respondToReschedule(
    @Param('id') id: string,
    @Body() body: { action: 'ACCEPT' | 'REJECT'; reason?: string },
    @Req() req: any
  ) {
    const userId = req.user?.id || 'attorney-1';
    return this.bookingService.respondToReschedule(id, body, userId);
  }

  @Post(':id/no-show')
  async reportNoShow(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: any
  ) {
    const userId = req.user?.id || 'attorney-1';
    return this.bookingService.reportNoShow(id, userId, body?.reason);
  }

  @Post('blackouts')
  async createBlackout(
    @Body() body: { attorneyId?: string; startDate: string; endDate: string; reason?: string },
    @Req() req: any
  ) {
    const attorneyId = body.attorneyId || req.user?.attorneyProfile?.id || req.user?.id || 'attorney-123';
    return this.bookingService.createBlackout(attorneyId, body);
  }

  @Get('blackouts')
  async getBlackouts(@Query('attorneyId') attorneyId: string, @Req() req: any) {
    const targetAttorneyId = attorneyId || req.user?.attorneyProfile?.id || req.user?.id || 'attorney-123';
    return this.bookingService.getBlackouts(targetAttorneyId);
  }

  @Post(':id/chat')
  async createBookingChat(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'client-1';
    return this.bookingService.getOrCreateBookingChat(id, userId);
  }

  @Get(':id/chat')
  async getBookingChat(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'client-1';
    return this.bookingService.getOrCreateBookingChat(id, userId);
  }

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
