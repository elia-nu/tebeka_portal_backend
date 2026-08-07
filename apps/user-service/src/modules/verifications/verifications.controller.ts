import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { VerificationsService } from './verifications.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('verifications')
export class VerificationsController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Post()
  async createVerification(@Body() body: any) {
    return this.verificationsService.createVerification(body);
  }

  @Get()
  async getVerifications(@Query() query: any) {
    return this.verificationsService.findAll(query);
  }

  @Get('my-case')
  async getAttorneyCaseView(@Query('attorneyId') attorneyId: string) {
    return this.verificationsService.getAttorneyCaseView(attorneyId);
  }

  @Get('fraud-workspace/:id')
  async getFraudWorkspace(@Param('id') id: string) {
    return this.verificationsService.getFraudWorkspace(id);
  }

  @Get(':id')
  async getVerificationById(@Param('id') id: string, @Req() req: any) {
    // Log document access audit log if requested by reviewer
    if (req.user?.id) {
      await this.verificationsService.logDocumentView(req.user.id, id, 'doc-preview', req.ip);
    }
    return this.verificationsService.findOne(id);
  }

  @Patch(':id/checklist/:itemId')
  async updateChecklist(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { status: 'PASSED' | 'FAILED'; remarks?: string },
    @Req() req: any
  ) {
    return this.verificationsService.updateChecklist(id, itemId, {
      status: body.status,
      remarks: body.remarks,
      reviewerId: req.user?.id || 'admin-reviewer-1'
    });
  }

  @Patch('standing-check/:attorneyId')
  async updateBarStandingCheck(
    @Param('attorneyId') attorneyId: string,
    @Body() body: { status: string; notes?: string },
    @Req() req: any
  ) {
    return this.verificationsService.updateBarStandingCheck(attorneyId, {
      status: body.status,
      checkedBy: req.user?.id || 'admin-reviewer-1',
      notes: body.notes
    });
  }

  @Patch(':id/approve')
  async approveVerification(@Param('id') id: string, @Req() req: any) {
    return this.verificationsService.approveVerification(id, req.user?.id || 'admin-reviewer-1');
  }

  @Patch(':id/reject')
  async rejectVerification(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.verificationsService.rejectVerification(id, body.reason || 'Verification rejected', req.user?.id || 'admin-reviewer-1');
  }

  @Patch(':id/request-documents')
  async requestDocuments(@Param('id') id: string, @Body() body: any) {
    return this.verificationsService.requestDocuments(id, body.notes || 'Additional documents requested');
  }

  @Post(':id/respond-more-info')
  async respondMoreInfo(@Param('id') id: string) {
    return this.verificationsService.respondMoreInfo(id);
  }

  @Post(':id/flag-fraud')
  async flagFraud(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.verificationsService.flagFraud(id, {
      flaggedByUserId: req.user?.id || 'reviewer-1',
      signalTypes: body.signalTypes || ['DUPLICATE_DOCUMENTS'],
      notes: body.notes
    });
  }

  @Post('correction-case')
  async createCorrectionCase(@Body() body: { previousCaseId: string; attorneyId: string }) {
    return this.verificationsService.createCorrectionCase(body.previousCaseId, body.attorneyId);
  }

  @Post('bulk-claim')
  async bulkClaim(@Body() body: { caseIds: string[] }, @Req() req: any) {
    return this.verificationsService.bulkClaim(body.caseIds, req.user?.id || 'admin-reviewer-1');
  }
}
