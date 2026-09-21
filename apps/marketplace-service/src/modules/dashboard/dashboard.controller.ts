import { Controller, Get, Query, Req, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '@workspace/auth';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('attorneys/me/dashboard-summary')
  async getMyDashboardSummary(@Query('attorneyId') attorneyId: string, @Req() req: any) {
    const targetAttorneyId = (req.user?.role === 'ADMIN' && attorneyId) ? attorneyId : (req.user?.attorneyProfile?.id || req.user?.id);
    if (!targetAttorneyId) {
      throw new BadRequestException('Attorney ID could not be resolved from session');
    }
    return this.dashboardService.getAttorneyDashboardSummary(targetAttorneyId);
  }

  @Get('marketplace/dashboard/summary')
  async getMarketplaceDashboardSummary(@Query('attorneyId') attorneyId: string, @Req() req: any) {
    const targetAttorneyId = (req.user?.role === 'ADMIN' && attorneyId) ? attorneyId : (req.user?.attorneyProfile?.id || req.user?.id);
    if (!targetAttorneyId) {
      throw new BadRequestException('Attorney ID could not be resolved from session');
    }
    return this.dashboardService.getAttorneyDashboardSummary(targetAttorneyId);
  }

  @Get('dashboard/attorney/summary')
  async getAttorneyDashboardSummaryAlias(@Query('attorneyId') attorneyId: string, @Req() req: any) {
    const targetAttorneyId = (req.user?.role === 'ADMIN' && attorneyId) ? attorneyId : (req.user?.attorneyProfile?.id || req.user?.id);
    if (!targetAttorneyId) {
      throw new BadRequestException('Attorney ID could not be resolved from session');
    }
    return this.dashboardService.getAttorneyDashboardSummary(targetAttorneyId);
  }

  @Get('dashboard/attorney/:attorneyId')
  async getAttorneyDashboardById(@Param('attorneyId') attorneyId: string) {
    return this.dashboardService.getAttorneyDashboardSummary(attorneyId);
  }
}
