import { Controller, Get, Query, Req, UsePipes, UseGuards, Headers } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@workspace/auth';
import { BookingService } from './booking.service';
import { QueryBookingDto, QueryBookingSchema } from './dto/booking.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminBookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('bookings')
  @UsePipes(new JoiValidationPipe(QueryBookingSchema))
  async getAdminBookings(
    @Query() query: QueryBookingDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const userId = req.user?.id || query.userId;
    return this.bookingService.findAllBookings(userId, 'ADMIN', query, correlationId);
  }

  @Get('queues/bookings')
  @UsePipes(new JoiValidationPipe(QueryBookingSchema))
  async getAdminBookingsQueue(
    @Query() query: QueryBookingDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const userId = req.user?.id || query.userId;
    return this.bookingService.findAllBookings(userId, 'ADMIN', query, correlationId);
  }
}
