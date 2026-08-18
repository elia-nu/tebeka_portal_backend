import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

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
