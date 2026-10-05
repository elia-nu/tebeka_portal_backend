import { Controller, Get, Post, Patch, Body, Param, Query, Req, UsePipes, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '@workspace/auth';
import { DisputeService } from './dispute.service';
import {
  CreateDisputeDto,
  CreateDisputeSchema,
  QueryDisputeDto,
  QueryDisputeSchema,
  ResolveDisputeDto,
  ResolveDisputeSchema,
} from './dto/dispute.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  // Open Dispute on Case (FR-CASE-06 / TC-CASE-04)
  @Post('cases/:id/dispute')
  @UsePipes(new JoiValidationPipe(CreateDisputeSchema))
  async openCaseDispute(
    @Param('id') caseId: string,
    @Body() body: CreateDisputeDto,
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.disputeService.openCaseDispute(caseId, body, userId);
  }

  // Open Dispute on Booking Consultation (TC-PAY-02 / FR-BOOK)
  @Post('bookings/:id/dispute')
  @UsePipes(new JoiValidationPipe(CreateDisputeSchema))
  async openBookingDispute(
    @Param('id') bookingId: string,
    @Body() body: CreateDisputeDto,
    @Req() req: any
  ) {
    const userId = req.user.id;
    return this.disputeService.openBookingDispute(bookingId, body, userId);
  }

  // Unified Queues Workspace: Disputes Queue (SCR-ADMIN-04 / FR-ADMIN-03)
  @Get('disputes')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(QueryDisputeSchema))
  async getDisputes(@Query() query: QueryDisputeDto) {
    return this.disputeService.getDisputes(query);
  }

  @Get('admin/disputes')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(QueryDisputeSchema))
  async getAdminDisputes(@Query() query: QueryDisputeDto) {
    return this.disputeService.getDisputes(query);
  }

  @Get('admin/queues/disputes')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(QueryDisputeSchema))
  async getAdminQueueDisputes(@Query() query: QueryDisputeDto) {
    return this.disputeService.getDisputes(query);
  }

  @Get('disputes/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async getDisputeById(@Param('id') id: string) {
    return this.disputeService.getDisputeById(id);
  }

  @Patch('disputes/:id/resolve')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(ResolveDisputeSchema))
  async resolveDispute(
    @Param('id') id: string,
    @Body() body: ResolveDisputeDto,
    @Req() req: any
  ) {
    const adminId = req.user.id;
    return this.disputeService.resolveDispute(id, body, adminId);
  }

  @Patch('disputes/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(ResolveDisputeSchema))
  async updateDispute(
    @Param('id') id: string,
    @Body() body: ResolveDisputeDto,
    @Req() req: any
  ) {
    const adminId = req.user.id;
    return this.disputeService.resolveDispute(id, body, adminId);
  }
}
