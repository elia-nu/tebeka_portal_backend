import { Controller, Post, Get, Patch, Body, Param, Query, Req, UsePipes, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@workspace/auth';
import { VerificationCaseService } from './services/verification-case.service';
import { VerificationDecisionService } from './services/verification-decision.service';
import { VerificationFraudService } from './services/verification-fraud.service';
import {
  UpdateChecklistDto,
  UpdateChecklistSchema,
  UpdateBarStandingDto,
  UpdateBarStandingSchema,
  RejectVerificationDto,
  RejectVerificationSchema,
  FlagFraudDto,
  FlagFraudSchema,
  QueryVerificationDto,
  QueryVerificationSchema,
  RequestAmendmentDto,
  RequestAmendmentSchema,
} from './dto/verification.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

import { UsersService } from '../users/users.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@AllowAnonymous()
@Controller('verifications')
export class VerificationsController {
  constructor(
    private readonly verificationCaseService: VerificationCaseService,
    private readonly verificationDecisionService: VerificationDecisionService,
    private readonly verificationFraudService: VerificationFraudService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async createVerification(@Body() body: any) {
    return this.verificationCaseService.createVerification(body);
  }

  @Get()
  @UsePipes(new JoiValidationPipe(QueryVerificationSchema))
  async getVerifications(@Query() query: QueryVerificationDto) {
    return this.verificationCaseService.findAll(query);
  }

  @AllowAnonymous()
  @Get('my-case')
  async getAttorneyCaseView(@Query('attorneyId') attorneyId: string, @Req() req: any) {
    const targetId = attorneyId || (await this.usersService.resolveUserId(req));
    return this.verificationCaseService.getAttorneyCaseView(targetId);
  }

  @Get('fraud-workspace/:id')
  async getFraudWorkspace(@Param('id') id: string) {
    return this.verificationFraudService.getFraudWorkspace(id);
  }

  @Get('cases')
  @UsePipes(new JoiValidationPipe(QueryVerificationSchema))
  async getVerificationsCases(@Query() query: QueryVerificationDto) {
    return this.verificationCaseService.findAll(query);
  }

  @Get(':id')
  async getVerificationById(@Param('id') id: string, @Req() req: any) {
    if (req.user?.id) {
      await this.verificationCaseService.logDocumentView(req.user.id, id, 'doc-preview', req.ip);
    }
    return this.verificationCaseService.findOne(id);
  }

  @Patch(':id/checklist/:itemId')
  @UsePipes(new JoiValidationPipe(UpdateChecklistSchema))
  async updateChecklist(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdateChecklistDto,
    @Req() req: any
  ) {
    return this.verificationCaseService.updateChecklist(id, itemId, {
      status: body.status,
      remarks: body.remarks,
      reviewerId: req.user?.id || 'admin-reviewer-1',
    });
  }

  @Patch('standing-check/:attorneyId')
  @UsePipes(new JoiValidationPipe(UpdateBarStandingSchema))
  async updateBarStandingCheck(
    @Param('attorneyId') attorneyId: string,
    @Body() body: UpdateBarStandingDto,
    @Req() req: any
  ) {
    return this.verificationFraudService.updateBarStandingCheck(attorneyId, {
      status: body.status,
      checkedBy: req.user?.id || 'admin-reviewer-1',
      notes: body.notes,
    });
  }

  @Patch(':id/approve')
  async approveVerification(@Param('id') id: string, @Req() req: any) {
    return this.verificationDecisionService.approveVerification(id, req.user?.id || 'admin-reviewer-1');
  }

  @Patch(':id/reject')
  @UsePipes(new JoiValidationPipe(RejectVerificationSchema))
  async rejectVerification(@Param('id') id: string, @Body() body: RejectVerificationDto, @Req() req: any) {
    return this.verificationDecisionService.rejectVerification(id, body.reason, req.user?.id || 'admin-reviewer-1');
  }

  @Post(':id/request-amendment')
  @UsePipes(new JoiValidationPipe(RequestAmendmentSchema))
  async requestAmendment(@Param('id') id: string, @Body() body: RequestAmendmentDto, @Req() req: any) {
    return this.verificationDecisionService.requestAmendment(id, body, req.user?.id || 'admin-reviewer-1');
  }

  @Patch(':id/request-docs')
  async requestDocuments(@Param('id') id: string, @Body() body: { notes: string; requestedFields?: string[] }) {
    return this.verificationDecisionService.requestDocuments(id, body.notes, body.requestedFields);
  }

  @Patch(':id/respond-info')
  async respondMoreInfo(@Param('id') id: string, @Body() body?: { replyNotes?: string; amendmentReply?: string }) {
    return this.verificationDecisionService.respondMoreInfo(id, body?.replyNotes || body?.amendmentReply);
  }

  @Post(':id/flag-fraud')
  @UsePipes(new JoiValidationPipe(FlagFraudSchema))
  async flagFraud(@Param('id') id: string, @Body() body: FlagFraudDto, @Req() req: any) {
    return this.verificationFraudService.flagFraud(id, {
      flaggedByUserId: req.user?.id || 'admin-reviewer-1',
      signalTypes: body.signalTypes,
      notes: body.notes,
    });
  }

  @Post('bulk-claim')
  async bulkClaim(@Body() body: any) {
    return { status: 'success', claimedCount: body?.caseIds?.length || 1 };
  }

  @Post('correction-case')
  async createCorrectionCase(@Body() body: any) {
    return { status: 'success', message: 'Correction case registered', caseId: `case-${Date.now()}` };
  }

  @Get('cases/:id/attorney-view')
  async getAttorneyCaseViewAlias(@Param('id') id: string) {
    return this.verificationCaseService.getAttorneyCaseView(id);
  }

  @Post(':id/approve')
  async approveVerificationPost(@Param('id') id: string, @Req() req: any) {
    return this.verificationDecisionService.approveVerification(id, req.user?.id || 'admin-reviewer-1');
  }

  @Post(':id/reject')
  @UsePipes(new JoiValidationPipe(RejectVerificationSchema))
  async rejectVerificationPost(@Param('id') id: string, @Body() body: RejectVerificationDto, @Req() req: any) {
    return this.verificationDecisionService.rejectVerification(id, body.reason, req.user?.id || 'admin-reviewer-1');
  }

  @Post(':id/request-info')
  async requestInfoPost(@Param('id') id: string, @Body() body: { notes?: string; requestedFields?: string[] }) {
    return this.verificationDecisionService.requestDocuments(id, body?.notes || 'Additional info requested', body?.requestedFields);
  }

  @Post(':id/guarded-changes/:changeId/approve')
  async approveGuardedChange(@Param('id') id: string, @Param('changeId') changeId: string) {
    return { status: 'APPROVED', changeId, caseId: id };
  }

  @Post(':id/guarded-changes/:changeId/reject')
  async rejectGuardedChange(@Param('id') id: string, @Param('changeId') changeId: string) {
    return { status: 'REJECTED', changeId, caseId: id };
  }

  @Patch(':id/request-documents')
  async requestDocumentsAlias(@Param('id') id: string, @Body() body: { notes: string; requestedFields?: string[] }) {
    return this.verificationDecisionService.requestDocuments(id, body?.notes || 'Additional documents requested', body?.requestedFields);
  }

  @Post(':id/respond-more-info')
  async respondMoreInfoAlias(@Param('id') id: string, @Body() body?: { replyNotes?: string; amendmentReply?: string }) {
    return this.verificationDecisionService.respondMoreInfo(id, body?.replyNotes || body?.amendmentReply);
  }
}
