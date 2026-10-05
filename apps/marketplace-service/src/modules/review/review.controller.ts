import { Controller, Get, Post, Patch, Body, Param, Query, Req, UsePipes, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles, Public } from '@workspace/auth';
import { ReviewService } from './review.service';
import {
  CreateReviewDto,
  CreateReviewSchema,
  QueryReviewDto,
  QueryReviewSchema,
  QueryReviewReportDto,
  QueryReviewReportSchema,
  UpdateReviewReportDto,
  UpdateReviewReportSchema,
} from './dto/review.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post('bookings/:bookingId/reviews')
  @UsePipes(new JoiValidationPipe(CreateReviewSchema))
  async createReview(@Param('bookingId') bookingId: string, @Body() body: CreateReviewDto, @Req() req: any) {
    const clientId = req.user?.id || body.clientId;
    return this.reviewService.createReview(bookingId, body, clientId);
  }

  @Public()
  @Get('attorneys/:attorneyId/reviews')
  @UsePipes(new JoiValidationPipe(QueryReviewSchema))
  async getAttorneyReviews(@Param('attorneyId') attorneyId: string, @Query() query: QueryReviewDto) {
    return this.reviewService.getAttorneyReviews(attorneyId, query);
  }

  @Post('reviews/:id/rebuttal')
  async submitRebuttal(
    @Param('id') id: string,
    @Body() body: { rebuttal: string },
    @Req() req: any
  ) {
    const attorneyId = req.user?.attorneyProfile?.id || req.user.id;
    return this.reviewService.submitRebuttal(id, body.rebuttal, attorneyId);
  }

  @Patch('reviews/:id/moderation-status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async updateModerationStatus(
    @Param('id') id: string,
    @Body() body: { status: any },
    @Req() req: any
  ) {
    const adminId = req.user.id;
    return this.reviewService.updateModerationStatus(id, body.status, adminId);
  }

  @Post('reviews/:id/report')
  async reportReview(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: any
  ) {
    const reportedBy = req.user.id;
    return this.reviewService.reportReview(id, body, reportedBy);
  }

  // Unified Admin Review Moderation Queue (SCR-ADMIN-04 / FR-ADMIN-03)
  @Get('reviews/reports')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(QueryReviewReportSchema))
  async getReviewReports(@Query() query: QueryReviewReportDto) {
    return this.reviewService.getReviewReports(query);
  }

  @Get('reviews/moderation-queue')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(QueryReviewReportSchema))
  async getReviewModerationQueue(@Query() query: QueryReviewReportDto) {
    return this.reviewService.getReviewReports(query);
  }

  @Get('admin/reviews/reports')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(QueryReviewReportSchema))
  async getAdminReviewReports(@Query() query: QueryReviewReportDto) {
    return this.reviewService.getReviewReports(query);
  }

  @Patch('reviews/reports/:reportId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(UpdateReviewReportSchema))
  async updateReviewReport(
    @Param('reportId') reportId: string,
    @Body() body: UpdateReviewReportDto,
    @Req() req: any
  ) {
    const adminId = req.user.id;
    return this.reviewService.updateReviewReport(reportId, body, adminId);
  }

  @Patch('reviews/reports/:reportId/status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(UpdateReviewReportSchema))
  async updateReviewReportStatus(
    @Param('reportId') reportId: string,
    @Body() body: UpdateReviewReportDto,
    @Req() req: any
  ) {
    const adminId = req.user.id;
    return this.reviewService.updateReviewReport(reportId, body, adminId);
  }
}
