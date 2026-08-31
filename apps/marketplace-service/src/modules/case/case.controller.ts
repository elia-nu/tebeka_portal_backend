import { Controller, Get, Post, Patch, Body, Param, Query, Req, UsePipes, Ip } from '@nestjs/common';
import { CaseService } from './case.service';
import { CreateCaseDto, CreateCaseSchema, UpdateCaseStatusDto, UpdateCaseStatusSchema, QueryCaseDto, QueryCaseSchema } from './dto/case.dto';
import { SignAgreementDto, SignAgreementSchema, DeclineAgreementDto, DeclineAgreementSchema } from './dto/agreement.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

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
    const userId = req.user?.id || query.userId;
    const role = req.user?.role || query.role || 'CLIENT';
    return this.caseService.findUserCases(userId, role, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.caseService.findOne(id);
  }

  @Patch(':id/status')
  @UsePipes(new JoiValidationPipe(UpdateCaseStatusSchema))
  async updateStatus(@Param('id') id: string, @Body() body: UpdateCaseStatusDto, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.caseService.updateCaseStatus(id, body.status, userId);
  }

  @Get(':id/agreement')
  async getCaseAgreement(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || req.headers['x-user-id'] || 'client-1';
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
    const userId = req.user?.id || req.headers['x-user-id'] || 'client-1';
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
    const userId = req.user?.id || req.headers['x-user-id'] || 'client-1';
    return this.caseService.declineCaseAgreement(id, body, userId);
  }

  @Post(':id/milestones')
  async createMilestone(
    @Param('id') id: string,
    @Body() body: { title: string; dueDate?: string },
    @Req() req: any
  ) {
    const userId = req.user?.id || 'attorney-1';
    return this.caseService.createMilestone(id, body, userId);
  }

  @Patch(':id/milestones/:milestoneId/status')
  async updateMilestoneStatus(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: { status: string },
    @Req() req: any
  ) {
    const userId = req.user?.id || 'attorney-1';
    return this.caseService.updateMilestoneStatus(id, milestoneId, body.status, userId);
  }

  @Post(':id/timeline')
  async addTimelineEvent(
    @Param('id') id: string,
    @Body() body: { title: string; description?: string; eventDate?: string },
    @Req() req: any
  ) {
    const userId = req.user?.id || 'attorney-1';
    return this.caseService.addTimelineEvent(id, body, userId);
  }

  @Get(':id/timeline')
  async getCaseTimeline(@Param('id') id: string) {
    return this.caseService.getCaseTimeline(id);
  }

  @Post(':id/chat')
  async createCaseChat(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'client-1';
    return this.caseService.getOrCreateCaseChat(id, userId);
  }

  @Get(':id/chat')
  async getCaseChat(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id || 'client-1';
    return this.caseService.getOrCreateCaseChat(id, userId);
  }
}
