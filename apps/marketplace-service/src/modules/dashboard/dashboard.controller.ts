import { Controller, Get, Query, Req, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('attorneys/me/dashboard-summary')
  async getMyDashboardSummary(@Query('attorneyId') attorneyId: string, @Req() req: any) {
    const targetAttorneyId = attorneyId || req.user?.attorneyProfile?.id || req.user?.id || 'attorney-123';
    return this.dashboardService.getAttorneyDashboardSummary(targetAttorneyId);
  }

  @Get('marketplace/dashboard/summary')
  async getMarketplaceDashboardSummary(@Query('attorneyId') attorneyId: string, @Req() req: any) {
    const targetAttorneyId = attorneyId || req.user?.attorneyProfile?.id || req.user?.id || 'attorney-123';
    return this.dashboardService.getAttorneyDashboardSummary(targetAttorneyId);
  }

  @Get('dashboard/attorney/summary')
  async getAttorneyDashboardSummaryAlias(@Query('attorneyId') attorneyId: string, @Req() req: any) {
    const targetAttorneyId = attorneyId || req.user?.attorneyProfile?.id || req.user?.id || 'attorney-123';
    return this.dashboardService.getAttorneyDashboardSummary(targetAttorneyId);
  }

  @Get('dashboard/attorney/:attorneyId')
  async getAttorneyDashboardById(@Param('attorneyId') attorneyId: string) {
    return this.dashboardService.getAttorneyDashboardSummary(attorneyId);
  }
}
