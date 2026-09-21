import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@workspace/auth';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview() {
    return this.analyticsService.getOverviewAnalytics();
  }

  @Get('attorneys')
  async getAttorneyAnalytics() {
    return this.analyticsService.getAttorneyAnalytics();
  }

  @Get('bookings')
  async getBookingAnalytics() {
    return this.analyticsService.getBookingAnalytics();
  }

  @Get('revenue')
  async getRevenueAnalytics() {
    return this.analyticsService.getRevenueAnalytics();
  }
}
