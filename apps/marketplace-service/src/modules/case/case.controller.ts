import { Controller, Get, Post, Patch, Body, Param, Query, Req, UsePipes, Ip, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '@workspace/auth';
import { CaseService } from './case.service';
import {
  CreateCaseDto,
  CreateCaseSchema,
  UpdateCaseStatusDto,
  UpdateCaseStatusSchema,
  QueryCaseDto,
  QueryCaseSchema,
  CaseDecisionDto,
  CaseDecisionSchema,
  ProposeMilestonesDto,
  ProposeMilestonesSchema,
  ApproveMilestonesDto,
  ApproveMilestonesSchema,
  CompleteMilestoneDto,
  CompleteMilestoneSchema,
  AcknowledgeMilestoneDto,
  AcknowledgeMilestoneSchema,
} from './dto/case.dto';
import { SignAgreementDto, SignAgreementSchema, DeclineAgreementDto, DeclineAgreementSchema } from './dto/agreement.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cases')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Post()
  @UsePipes(new JoiValidationPipe(CreateCaseSchema))
  async createCase(@Body() body: CreateCaseDto, @Req() req: any) {
    const clientId = req.user?.id || body.clientId;
    return this.caseService.createCase(body, clientId);
  }

  @Get()
  @UsePipes(new JoiValidationPipe(QueryCaseSchema))
  async findUserCases(@Query() query: QueryCaseDto, @Req() req: any) {
    const userId = req.user.id;
    const role = req.user.role || query.role || 'CLIENT';
    return this.caseService.findUserCases(userId, role, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.caseService.findOne(id);
  }

  // FR-CASE-02: Attorney Accept/Decline decision with Conflict of Interest gate
  @Post(':id/decision')
  @UsePipes(new JoiValidationPipe(CaseDecisionSchema))
  async recordCaseDecision(
    @Param('id') id: string,
    @Body() body: CaseDecisionDto,
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.caseService.recordCaseDecision(
      id,
      body.decision,
      body.coiDeclaration || { declineReason: body.declineReason },
      userId
    );
  }

  @Patch(':id/status')
  @UsePipes(new JoiValidationPipe(UpdateCaseStatusSchema))
  async updateStatus(@Param('id') id: string, @Body() body: UpdateCaseStatusDto, @Req() req: any) {
    const userId = req.user.id;
    return this.caseService.updateCaseStatus(id, body.status, userId);
  }

  @Get(':id/agreement')
  async getCaseAgreement(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.caseService.getCaseAgreement(id, userId);
  }

  @Post(':id/agreement/sign')
  @UsePipes(new JoiValidationPipe(SignAgreementSchema))
  async signCaseAgreement(
    @Param('id') id: string,
    @Body() body: SignAgreementDto,
    @Req() req: any,
    @Ip() ip: string
  ) {
    const userId = req.user.id;
    const clientIp = req.headers['x-forwarded-for'] || ip || '127.0.0.1';
    return this.caseService.signCaseAgreement(id, body, userId, String(clientIp));
  }

  @Post(':id/agreement/decline')
  @UsePipes(new JoiValidationPipe(DeclineAgreementSchema))
  async declineCaseAgreement(
    @Param('id') id: string,
    @Body() body: DeclineAgreementDto,
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.caseService.declineCaseAgreement(id, body, userId);
  }

  // FR-CASE-04: Attorney proposes milestones
  @Post(':id/milestones')
  @UsePipes(new JoiValidationPipe(ProposeMilestonesSchema))
  async createMilestone(
    @Param('id') id: string,
    @Body() body: ProposeMilestonesDto,
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.caseService.proposeMilestones(id, body, userId);
  }

  // FR-CASE-04: Client approves milestone plan before IN_PROGRESS
  @Post(':id/milestones/approve')
  @UsePipes(new JoiValidationPipe(ApproveMilestonesSchema))
  async approveMilestones(
    @Param('id') id: string,
    @Body() body: ApproveMilestonesDto,
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.caseService.approveMilestones(id, body, userId);
  }

  @Post(':id/milestones/:milestoneId/approve')
  async approveSingleMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.caseService.approveMilestones(id, { milestoneIds: [milestoneId] }, userId);
  }

  // FR-CASE-04: Attorney submits milestone completion deliverable
  @Post(':id/milestones/:milestoneId/complete')
  @UsePipes(new JoiValidationPipe(CompleteMilestoneSchema))
  async completeMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: CompleteMilestoneDto,
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.caseService.completeMilestone(id, milestoneId, userId, body.deliverableNotes);
  }

  // FR-CASE-04: Client acknowledges milestone completion
  @Post(':id/milestones/:milestoneId/acknowledge')
  @UsePipes(new JoiValidationPipe(AcknowledgeMilestoneSchema))
  async acknowledgeMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: AcknowledgeMilestoneDto,
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.caseService.acknowledgeMilestone(id, milestoneId, userId, body);
  }

  @Patch(':id/milestones/:milestoneId/status')
  async updateMilestoneStatus(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: { status: string },
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.caseService.updateMilestoneStatus(id, milestoneId, body.status, userId);
  }

  @Post(':id/timeline')
  async addTimelineEvent(
    @Param('id') id: string,
    @Body() body: { title: string; description?: string; eventDate?: string },
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.caseService.addTimelineEvent(id, body, userId);
  }

  @Get(':id/timeline')
  async getCaseTimeline(@Param('id') id: string) {
    return this.caseService.getCaseTimeline(id);
  }

  @Post(':id/chat')
  async createCaseChat(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.caseService.getOrCreateCaseChat(id, userId);
  }

  @Get(':id/chat')
  async getCaseChat(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    return this.caseService.getOrCreateCaseChat(id, userId);
  }
}
