import { Controller, Post, Get, Body, Query, Req } from '@nestjs/common';
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
}
