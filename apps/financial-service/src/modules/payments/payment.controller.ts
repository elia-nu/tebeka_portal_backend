import { Controller, Post, Get, Patch, Body, Query, Param, Req } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createPayment(@Body() body: any, @Req() req: any) {
    const userId = req.user?.id || body.payerId || 'system-user';
    return this.paymentService.createPayment(body, userId);
  }

  @Post('request')
  async requestPayment(@Body() body: any, @Req() req: any) {
    const attorneyId = req.user?.id || body.requestedBy || 'system-attorney';
    return this.paymentService.requestPayment(body, attorneyId);
  }

  @Post('approve')
  async approvePayment(@Body() body: any, @Req() req: any) {
    const clientId = req.user?.id || body.approvedBy || 'system-client';
    return this.paymentService.approvePayment(body.paymentId, clientId);
  }

  @Get()
  async getPayments(@Query() query: any) {
    return this.paymentService.getPayments(query);
  }

  @Post('payout-account')
  async setupPayoutAccount(@Body() body: any, @Req() req: any) {
    const attorneyId = req.user?.id || body.attorneyId || 'system-attorney';
    return this.paymentService.setupAttorneyPayoutAccount(attorneyId, body);
  }

  @Get('banks')
  async getBanks() {
    return this.paymentService.getBanks();
  }

  @Get('wallet')
  async getWallet(@Query('userId') queryUserId: string, @Req() req: any) {
    const userId = req.user?.id || queryUserId || 'system-attorney';
    return this.paymentService.getAttorneyWallet(userId);
  }

  // --- MANUAL REFUND MANAGEMENT (ADMIN & ATTORNEY PORTAL) ---

  @Get('refunds')
  async getRefunds(@Query() query: any) {
    return this.paymentService.getRefunds(query);
  }

  @Patch('refunds/:id/process')
  async processManualRefund(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @Req() req: any
  ) {
    const adminId = req.user?.id || 'admin_user';
    return this.paymentService.processManualRefund(id, adminId, body?.notes);
  }

  @Patch('refunds/:id/reject')
  async rejectManualRefund(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: any
  ) {
    const adminId = req.user?.id || 'admin_user';
    return this.paymentService.rejectManualRefund(id, adminId, body.reason || 'Admin rejected refund');
  }
}
