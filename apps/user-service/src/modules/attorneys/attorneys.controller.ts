import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Req, UsePipes, UseInterceptors, UploadedFiles, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@workspace/auth';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { createMulterOptions } from '@workspace/storage';
import { relative, resolve } from 'path';

const CREDENTIAL_MAX_SIZE = 10 * 1024 * 1024;
const CREDENTIAL_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
import { AttorneyProfileService } from './services/attorney-profile.service';
import { AttorneyEducationService } from './services/attorney-education.service';
import { AttorneyScheduleService } from './services/attorney-schedule.service';
import { AttorneyProfileChangeService } from './services/attorney-profile-change.service';
import { UsersService } from '../users/users.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import {
  UpdateAttorneyProfileDto,
  UpdateAttorneyProfileSchema,
  AddEducationDto,
  AddEducationSchema,
  QueryAttorneyDto,
  QueryAttorneySchema,
  SubmitAmendmentDto,
  SubmitAmendmentSchema,
} from './dto/attorney.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@AllowAnonymous()
@Controller()
export class AttorneysController {
  constructor(
    private readonly attorneyProfileService: AttorneyProfileService,
    private readonly attorneyEducationService: AttorneyEducationService,
    private readonly attorneyScheduleService: AttorneyScheduleService,
    private readonly attorneyProfileChangeService: AttorneyProfileChangeService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(req: any): Promise<string> {
    return this.usersService.resolveUserId(req);
  }

  private async resolveProfileId(req: any): Promise<string> {
    const userId = await this.resolveUserId(req);
    const profile = await this.attorneyProfileService.findProfileByUserId(userId);
    return profile.id;
  }

  private extractDocUrls(files: any[]): any {
    const docUrls: any = {};
    if (files && files.length > 0) {
      const uploadDir = resolve(process.env.LOCAL_UPLOAD_DIR || './uploads');
      for (const file of files) {
        const relativeKey = relative(uploadDir, file.path).replace(/\\/g, '/');
        const fname = file.fieldname;
        if (fname === 'licenseBook' || fname === 'licenseBookUrl' || fname === 'license') {
          docUrls.licenseBookUrl = relativeKey;
        } else if (fname === 'barRegistration' || fname === 'barRegistrationUrl' || fname === 'barCertificate') {
          docUrls.barRegistrationUrl = relativeKey;
        } else if (
          fname === 'nationalId' ||
          fname === 'nationalIdDocument' ||
          fname === 'nationalIdDocumentUrl' ||
          fname === 'nationalIdFile' ||
          fname === 'nationalIdCard' ||
          fname === 'identityCard' ||
          fname === 'nationalIdKey'
        ) {
          docUrls.nationalIdDocumentUrl = relativeKey;
        } else {
          if (!docUrls.licenseBookUrl) docUrls.licenseBookUrl = relativeKey;
          else if (!docUrls.barRegistrationUrl) docUrls.barRegistrationUrl = relativeKey;
          else if (!docUrls.nationalIdDocumentUrl) docUrls.nationalIdDocumentUrl = relativeKey;
        }
      }
    }
    return docUrls;
  }

  // ═══════════════════════════════════════════════════════════════
  // TOKEN-BASED "me" ROUTES (must be registered BEFORE :id routes)
  // ═══════════════════════════════════════════════════════════════

  // --- My Profile ---
  @AllowAnonymous()
  @Get('attorneys/me')
  async getMyProfile(@Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyProfileService.findOne(profileId);
  }

  @AllowAnonymous()
  @Patch('attorneys/me')
  @UseInterceptors(AnyFilesInterceptor(createMulterOptions('credentials', CREDENTIAL_MAX_SIZE, CREDENTIAL_ALLOWED_TYPES)))
  async updateMyProfile(@UploadedFiles() files: any[], @Body() rawBody: any, @Req() req: any) {
    const body = new JoiValidationPipe(UpdateAttorneyProfileSchema).transform(rawBody, { type: 'body' });
    const profileId = await this.resolveProfileId(req);
    const docUrls = this.extractDocUrls(files);
    return this.attorneyProfileService.updateAttorney(profileId, { ...body, ...docUrls });
  }

  @AllowAnonymous()
  @Post('attorneys/me/submit-amendment')
  @UseInterceptors(AnyFilesInterceptor(createMulterOptions('credentials', CREDENTIAL_MAX_SIZE, CREDENTIAL_ALLOWED_TYPES)))
  async submitMyAmendment(@UploadedFiles() files: any[], @Body() rawBody: any, @Req() req: any) {
    const body = new JoiValidationPipe(SubmitAmendmentSchema).transform(rawBody, { type: 'body' });
    const profileId = await this.resolveProfileId(req);
    const docUrls = this.extractDocUrls(files);
    return this.attorneyProfileService.submitAmendmentResponse(profileId, { ...body, ...docUrls });
  }

  @AllowAnonymous()
  @Patch('attorneys/me/publish')
  async publishMyProfile(@Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyProfileService.publishProfile(profileId);
  }

  @AllowAnonymous()
  @Patch('attorneys/me/hide')
  async hideMyProfile(@Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyProfileService.hideProfile(profileId);
  }

  // --- My Credentials ---
  @AllowAnonymous()
  @Get('attorneys/me/credentials')
  async getMyCredentials(@Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyProfileService.getMyCredentials(profileId);
  }

  @AllowAnonymous()
  @Get('attorneys/me/credentials-public')
  async getMyPublicCredentials(@Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyProfileService.getPublicCredentials(profileId);
  }

  // --- My Education ---
  @AllowAnonymous()
  @Post('attorneys/me/education')
  @UsePipes(new JoiValidationPipe(AddEducationSchema))
  async addMyEducation(@Body() body: AddEducationDto, @Req() req: any) {
    const userId = await this.resolveUserId(req);
    return this.attorneyEducationService.addEducation(userId, body);
  }

  @AllowAnonymous()
  @Get('attorneys/me/education')
  async getMyEducation(@Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyEducationService.getEducation(profileId);
  }

  @AllowAnonymous()
  @Delete('attorneys/me/education/:eduId')
  async removeMyEducation(@Param('eduId') eduId: string, @Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyEducationService.removeEducation(profileId, eduId);
  }

  // --- My Availability ---
  @AllowAnonymous()
  @Get('attorneys/me/availability')
  async getMyAvailability(@Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyScheduleService.getAvailability(profileId);
  }

  @AllowAnonymous()
  @Post('attorneys/me/availability')
  async createMyAvailability(@Body() body: any, @Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyScheduleService.createAvailability(profileId, body);
  }

  @AllowAnonymous()
  @Patch('attorneys/me/availability/:availId')
  async updateMyAvailability(@Param('availId') availId: string, @Body() body: any, @Req() req: any) {
    await this.resolveProfileId(req); // ownership check
    return this.attorneyScheduleService.updateAvailability(availId, body);
  }

  @AllowAnonymous()
  @Delete('attorneys/me/availability/:availId')
  async deleteMyAvailability(@Param('availId') availId: string, @Req() req: any) {
    await this.resolveProfileId(req);
    return this.attorneyScheduleService.deleteAvailability(availId);
  }

  @AllowAnonymous()
  @Post('attorneys/me/block-date')
  async blockMyDate(@Body() body: any, @Req() req: any) {
    await this.resolveProfileId(req);
    return this.attorneyScheduleService.blockDate(body);
  }

  @AllowAnonymous()
  @Post('attorneys/me/vacation')
  async setMyVacation(@Body() body: any, @Req() req: any) {
    await this.resolveProfileId(req);
    return this.attorneyScheduleService.setVacation(body);
  }

  // --- My Practice Areas ---
  @AllowAnonymous()
  @Post('attorneys/me/practice-areas')
  async assignMyPracticeArea(@Body() body: any, @Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyScheduleService.assignPracticeAreaToAttorney(profileId, body);
  }

  @AllowAnonymous()
  @Delete('attorneys/me/practice-areas/:paId')
  async removeMyPracticeArea(@Param('paId') paId: string, @Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyScheduleService.removePracticeAreaFromAttorney(profileId, paId);
  }

  // --- My Profile Changes ---
  @AllowAnonymous()
  @Post('attorneys/me/request-profile-change')
  async requestMyProfileChange(@Body() body: any, @Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyProfileChangeService.requestProfileChange(profileId, body);
  }

  @AllowAnonymous()
  @Get('attorneys/me/pending-profile-changes')
  async getMyPendingProfileChanges(@Req() req: any) {
    const profileId = await this.resolveProfileId(req);
    return this.attorneyProfileChangeService.getPendingProfileChanges(profileId);
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMIN / PUBLIC ROUTES (by explicit attorney profile ID)
  // ═══════════════════════════════════════════════════════════════

  @Post('attorneys')
  async createAttorney(@Body() body: any) {
    return this.attorneyProfileService.createAttorney(body);
  }

  @AllowAnonymous()
  @Get('attorneys')
  @UsePipes(new JoiValidationPipe(QueryAttorneySchema))
  async getAttorneys(@Query() query: QueryAttorneyDto) {
    return this.attorneyProfileService.findAll(query);
  }

  @AllowAnonymous()
  @Get('attorneys/:id')
  async getAttorneyById(@Param('id') id: string) {
    return this.attorneyProfileService.findOne(id);
  }

  @AllowAnonymous()
  @Get('attorneys/:id/credentials-public')
  async getPublicCredentials(@Param('id') id: string) {
    return this.attorneyProfileService.getPublicCredentials(id);
  }

  @Patch('attorneys/:id')
  @UseInterceptors(AnyFilesInterceptor(createMulterOptions('credentials', CREDENTIAL_MAX_SIZE, CREDENTIAL_ALLOWED_TYPES)))
  async updateAttorney(@Param('id') id: string, @UploadedFiles() files: any[], @Body() rawBody: any) {
    const body = new JoiValidationPipe(UpdateAttorneyProfileSchema).transform(rawBody, { type: 'body' });
    const docUrls = this.extractDocUrls(files);
    return this.attorneyProfileService.updateAttorney(id, { ...body, ...docUrls });
  }

  @Delete('attorneys/:id')
  async deleteAttorney(@Param('id') id: string) {
    return this.attorneyProfileService.deleteAttorney(id);
  }

  @Patch('attorneys/:id/publish')
  async publishProfile(@Param('id') id: string) {
    return this.attorneyProfileService.publishProfile(id);
  }

  @Patch('attorneys/:id/hide')
  async hideProfile(@Param('id') id: string) {
    return this.attorneyProfileService.hideProfile(id);
  }

  @Patch('attorneys/:id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async moderateProfile(
    @Param('id') id: string,
    @Body() body: { action: 'WARN' | 'SUSPEND' | 'RESTORE'; reasonCode: string; adminNote: string }
  ) {
    return this.attorneyProfileService.moderateProfile(id, body);
  }

  @Post('attorneys/:id/education')
  @UsePipes(new JoiValidationPipe(AddEducationSchema))
  async addEducation(@Param('id') id: string, @Body() body: AddEducationDto) {
    return this.attorneyEducationService.addEducation(id, body);
  }

  @Get('attorneys/:id/education')
  async getEducation(@Param('id') id: string) {
    return this.attorneyEducationService.getEducation(id);
  }

  @Post('attorneys/:id/availability')
  async createAvailability(@Param('id') id: string, @Body() body: any) {
    return this.attorneyScheduleService.createAvailability(id, body);
  }

  @Get('attorneys/:id/availability')
  async getAvailability(@Param('id') id: string) {
    return this.attorneyScheduleService.getAvailability(id);
  }

  @Post('availability/vacation')
  async createVacationAlias(@Body() body: any) {
    return this.attorneyScheduleService.setVacation(body);
  }

  @Delete('attorneys/:id/education/:eduId')
  async removeEducation(@Param('id') id: string, @Param('eduId') eduId: string) {
    return this.attorneyEducationService.removeEducation(id, eduId);
  }

  @Post('attorneys/:id/request-profile-change')
  async requestProfileChange(@Param('id') id: string, @Body() body: any) {
    return this.attorneyProfileChangeService.requestProfileChange(id, body);
  }

  @Get('attorneys/:id/pending-profile-changes')
  async getPendingProfileChanges(@Param('id') id: string) {
    return this.attorneyProfileChangeService.getPendingProfileChanges(id);
  }

  @Patch('attorneys/profile-changes/:changeId/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async approveProfileChange(@Param('changeId') changeId: string, @Req() req: any) {
    return this.attorneyProfileChangeService.approveProfileChange(changeId, req.user?.id || 'admin-reviewer');
  }

  @Patch('attorneys/profile-changes/:changeId/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async rejectProfileChange(@Param('changeId') changeId: string, @Body() body: { reason: string }, @Req() req: any) {
    return this.attorneyProfileChangeService.rejectProfileChange(changeId, body.reason, req.user?.id || 'admin-reviewer');
  }
}
