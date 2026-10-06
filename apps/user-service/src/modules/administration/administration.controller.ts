import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, Public } from '@workspace/auth';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { AdministrationService } from './administration.service';
import { AttorneyProfileChangeService } from '../attorneys/services/attorney-profile-change.service';
import { CreatePracticeAreaDto, UpdatePracticeAreaDto } from './dto/practice-area.dto';

@AllowAnonymous()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdministrationController {
  constructor(
    private readonly administrationService: AdministrationService,
    private readonly attorneyProfileChangeService: AttorneyProfileChangeService
  ) {}

  @Get('users')
  async getAdminUsers(@Query() query: any) {
    return this.administrationService.getAdminUsers(query);
  }

  @Get('users/statistics')
  async getUserStatistics() {
    return this.administrationService.getUserStatistics();
  }

  @Get('platform-health')
  async getPlatformHealth() {
    return this.administrationService.getPlatformHealth();
  }

  @Get('business-queues')
  async getUnifiedBusinessQueues() {
    return this.administrationService.getUnifiedBusinessQueues();
  }

  @Patch('users/:id/suspend-reasoned')
  async adminSuspendUserReasoned(
    @Param('id') id: string,
    @Body() body: { reasonCode: string; adminNote: string },
    @Req() req: any
  ) {
    return this.administrationService.adminSuspendUserReasoned(id, {
      reasonCode: body.reasonCode,
      adminNote: body.adminNote,
      adminId: req.user.id,
      ipAddress: req.ip
    });
  }

  @Patch('users/:id/reset-password')
  async adminResetPassword(@Param('id') id: string, @Body() body: any) {
    return this.administrationService.adminResetPassword(id, body);
  }

  @Post('users/:id/impersonate')
  async impersonateUser(@Param('id') id: string) {
    return this.administrationService.impersonateUser(id);
  }

  @Get('users/:id/login-history')
  async getUserLoginHistory(@Param('id') id: string) {
    return this.administrationService.getUserLoginHistory(id);
  }

  @Get('attorneys')
  async getAdminAttorneys(@Query() query: any) {
    return this.administrationService.getAdminAttorneys(query);
  }

  @Get('attorneys/statistics')
  async getAttorneyStatistics() {
    return this.administrationService.getAttorneyStatistics();
  }

  @Patch('attorneys/:id/verify')
  async adminVerifyAttorney(@Param('id') id: string) {
    return this.administrationService.adminVerifyAttorney(id);
  }

  @Patch('attorneys/:id/reject')
  async adminRejectAttorney(@Param('id') id: string, @Body() body: any) {
    return this.administrationService.adminRejectAttorney(id, body.reason);
  }

  @Patch('attorneys/:id/suspend')
  async adminSuspendAttorney(@Param('id') id: string) {
    return this.administrationService.adminSuspendAttorney(id);
  }

  @Get('attorneys/:id/pending-profile-changes')
  async getPendingProfileChanges(@Param('id') id: string) {
    return this.attorneyProfileChangeService.getPendingProfileChanges(id);
  }

  @Patch('attorneys/profile-changes/:changeId/approve')
  async approveProfileChange(@Param('changeId') changeId: string, @Req() req: any) {
    const reviewerId = req.user?.id || 'admin-reviewer';
    return this.attorneyProfileChangeService.approveProfileChange(changeId, reviewerId);
  }

  @Patch('attorneys/profile-changes/:changeId/reject')
  async rejectProfileChange(
    @Param('changeId') changeId: string,
    @Body() body: { reason: string },
    @Req() req: any
  ) {
    const reviewerId = req.user?.id || 'admin-reviewer';
    return this.attorneyProfileChangeService.rejectProfileChange(changeId, body.reason, reviewerId);
  }

  // ==========================================
  // PRACTICE AREAS ADMIN CRUD ENDPOINTS
  // ==========================================

  @Public()
  @AllowAnonymous()
  @Get('practice-areas')
  async getAdminPracticeAreas(@Query() query: any) {
    return this.administrationService.getAdminPracticeAreas(query);
  }

  @Public()
  @AllowAnonymous()
  @Get('practice-areas/:id')
  async getAdminPracticeAreaById(@Param('id') id: string) {
    return this.administrationService.getAdminPracticeAreaById(id);
  }

  @Post('practice-areas')
  async createAdminPracticeArea(@Body() body: CreatePracticeAreaDto) {
    return this.administrationService.createAdminPracticeArea(body);
  }

  @Patch('practice-areas/:id')
  async updateAdminPracticeArea(
    @Param('id') id: string,
    @Body() body: UpdatePracticeAreaDto
  ) {
    return this.administrationService.updateAdminPracticeArea(id, body);
  }

  @Delete('practice-areas/:id')
  async deleteAdminPracticeArea(@Param('id') id: string) {
    return this.administrationService.deleteAdminPracticeArea(id);
  }
}
