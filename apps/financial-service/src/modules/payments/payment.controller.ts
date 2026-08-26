import { Controller, Post, Get, Patch, Body, Query, Param, Req } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { GeoPaymentService } from './services/geo-payment.service';
import { TransactionService } from './services/transaction.service';
import { FinancialAnalyticsService } from './services/financial-analytics.service';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly geoPaymentService: GeoPaymentService,
    private readonly transactionService: TransactionService,
    private readonly analyticsService: FinancialAnalyticsService,
  ) {}

  // =========================================================================
  // 1. GEO GATEWAY DETECTION (CHAPA / STRIPE RESOLUTION)
  // =========================================================================

  @Get('detect-gateway')
  async detectGateway(@Query('country') overrideCountry: string, @Req() req: any) {
    const clientIp = this.geoPaymentService.extractClientIp(req);
    return this.paymentService.detectGateway(clientIp, overrideCountry);
  }

  // =========================================================================
  // 2. CHECKOUT & CREATION
  // =========================================================================

  @Post()
  async createPayment(@Body() body: any, @Req() req: any) {
    const userId = req.user?.id || body.payerId || 'system-user';
    const clientIp = this.geoPaymentService.extractClientIp(req);
    return this.paymentService.createPayment(body, userId, clientIp);
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

  // =========================================================================
  // 3. ROLE-BASED TRANSACTION MANAGEMENT (ADMIN, ATTORNEY, CLIENT)
  // =========================================================================

  /**
   * Admin Overall Transactions & Financial Volume Summary
   */
  @Get('admin/transactions')
  async getAdminTransactions(@Query() query: any) {
    return this.transactionService.getAdminTransactions(query);
  }

  /**
   * Admin Financial Analytics (Revenue, Time Series Trends, Top Earners, Rails)
   */
  @Get('admin/analytics')
  async getAdminAnalytics(@Query() query: any) {
    return this.analyticsService.getAdminAnalytics(query);
  }

  /**
   * Attorney Transaction Ledger & Incoming Client Payments
   */
  @Get('attorney/transactions')
  async getAttorneyTransactions(@Query() query: any, @Req() req: any) {
    const attorneyId = req.user?.id || query.attorneyId || 'system-attorney';
    return this.transactionService.getAttorneyTransactions(attorneyId, query);
  }

  /**
   * Attorney Financial Analytics (Earnings Timeline, Service Type Breakdown, Top Cases)
   */
  @Get('attorney/analytics')
  async getAttorneyAnalytics(@Query() query: any, @Req() req: any) {
    const attorneyId = req.user?.id || query.attorneyId || 'system-attorney';
    return this.analyticsService.getAttorneyAnalytics(attorneyId, query);
  }

  /**
   * Client Transaction Flow & Outflow History
   */
  @Get('client/transactions')
  async getClientTransactions(@Query() query: any, @Req() req: any) {
    const clientId = req.user?.id || query.clientId || 'system-client';
    return this.transactionService.getClientTransactions(clientId, query);
  }

  /**
   * Client Financial Analytics (Expenditure Breakdown, Spending Trends, Refund History)
   */
  @Get('client/analytics')
  async getClientAnalytics(@Query() query: any, @Req() req: any) {
    const clientId = req.user?.id || query.clientId || 'system-client';
    return this.analyticsService.getClientAnalytics(clientId, query);
  }

  /**
   * Single Transaction Details & Ledger Timeline
   */
  @Get('transactions/:id')
  async getTransactionDetails(@Param('id') id: string, @Req() req: any) {
    const userContext = req.user ? { userId: req.user.id, role: req.user.role } : undefined;
    return this.transactionService.getTransactionDetails(id, userContext);
  }

  /**
   * Printable / Downloadable Transaction Receipt
   */
  @Get('transactions/:id/receipt')
  async getTransactionReceipt(@Param('id') id: string, @Req() req: any) {
    const userContext = req.user ? { userId: req.user.id, role: req.user.role } : undefined;
    return this.transactionService.getTransactionReceipt(id, userContext);
  }

  // =========================================================================
  // 4. ATTORNEY PAYOUT SUBACCOUNTS (CHAPA & STRIPE CONNECT)
  // =========================================================================

  @Post('payout-account')
  async setupPayoutAccount(@Body() body: any, @Req() req: any) {
    const attorneyId = req.user?.id || body.attorneyId || 'system-attorney';
    return this.paymentService.setupAttorneyPayoutAccount(attorneyId, body);
  }

  @Post('stripe/connect-account')
  async setupStripeConnectAccount(@Body() body: any, @Req() req: any) {
    const attorneyId = req.user?.id || body.attorneyId || 'system-attorney';
    return this.paymentService.setupAttorneyStripeAccount(attorneyId, body);
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

  // =========================================================================
  // 5. ADMIN COMMISSION CONFIGURATION
  // =========================================================================

  @Get('admin/commission')
  async getAdminCommission() {
    const defaultPercentage = await this.paymentService.getGlobalPlatformCommission();
    return {
      success: true,
      defaultCommissionPercentage: defaultPercentage,
    };
  }

  @Patch('admin/commission')
  async updateGlobalCommission(
    @Body() body: { commissionPercentage: number },
    @Req() req: any
  ) {
    const adminId = req.user?.id || 'admin-user';
    return this.paymentService.updateGlobalPlatformCommission(adminId, Number(body.commissionPercentage));
  }

  @Patch('admin/attorney/:attorneyId/commission')
  async updateAttorneyCommission(
    @Param('attorneyId') attorneyId: string,
    @Body() body: { commissionPercentage: number },
    @Req() req: any
  ) {
    const adminId = req.user?.id || 'admin-user';
    return this.paymentService.updateAttorneyCommission(attorneyId, Number(body.commissionPercentage), adminId);
  }

  // =========================================================================
  // 6. MANUAL REFUND MANAGEMENT (ADMIN & ATTORNEY PORTAL)
  // =========================================================================

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
