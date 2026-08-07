import { Controller, Post, Get, Delete, Body, Req, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @AllowAnonymous()
  @Post('register/client')
  async registerClient(@Body() body: any) {
    return this.authService.registerClient(body);
  }

  @AllowAnonymous()
  @Post('register/attorney')
  async registerAttorney(@Body() body: any) {
    return this.authService.registerAttorney(body);
  }

  @Post('register/admin')
  async registerAdmin(@Body() body: any, @Req() req: any) {
    return this.authService.registerAdmin(body, req.user?.role);
  }

  @AllowAnonymous()
  @Post('register/invite')
  async registerInvite(@Body() body: any) {
    return this.authService.registerInvite(body);
  }

  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: any) {
    return this.authService.logout(req.headers);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout-all')
  async logoutAll(@Req() req: any) {
    return this.authService.logoutAll(req.headers);
  }

  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @Post('refresh-token')
  async refreshToken(@Body() body: any) {
    return this.authService.refreshToken(body);
  }

  @Get('me')
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.headers);
  }

  @HttpCode(HttpStatus.OK)
  @Post('switch-account')
  async switchAccount(@Body() body: any) {
    return this.authService.switchAccount(body);
  }

  @AllowAnonymous()
  @Post('email/send-verification')
  async sendEmailVerification(@Body() body: any) {
    return this.authService.sendEmailVerification(body);
  }

  @AllowAnonymous()
  @Post('email/verify')
  async verifyEmail(@Body() body: any) {
    return this.authService.verifyEmail(body);
  }

  @AllowAnonymous()
  @Post('email/resend-verification')
  async resendEmailVerification(@Body() body: any) {
    return this.authService.resendEmailVerification(body);
  }

  @AllowAnonymous()
  @Post('phone/send-verification')
  async sendPhoneVerification(@Body() body: any) {
    return this.authService.sendPhoneVerification(body);
  }

  @AllowAnonymous()
  @Post('phone/verify')
  async verifyPhone(@Body() body: any) {
    return this.authService.verifyPhone(body);
  }

  @AllowAnonymous()
  @Post('phone/resend-verification')
  async resendPhoneVerification(@Body() body: any) {
    return this.authService.resendPhoneVerification(body);
  }

  @AllowAnonymous()
  @Post('otp/request')
  async requestOtp(@Body() body: any) {
    return this.authService.requestOtp(body);
  }

  @AllowAnonymous()
  @Post('otp/verify')
  async verifyOtp(@Body() body: any) {
    return this.authService.verifyOtp(body);
  }

  @AllowAnonymous()
  @Post('otp/resend')
  async resendOtp(@Body() body: any) {
    return this.authService.resendOtp(body);
  }

  @AllowAnonymous()
  @Post('otp/cancel')
  async cancelOtp(@Body() body: any) {
    return this.authService.cancelOtp(body);
  }

  @AllowAnonymous()
  @Post('password/forgot')
  async forgotPassword(@Body() body: any) {
    return this.authService.forgotPassword(body);
  }

  @AllowAnonymous()
  @Post('password/reset')
  async resetPassword(@Body() body: any) {
    return this.authService.resetPassword(body);
  }

  @Post('password/change')
  async changePassword(@Body() body: any, @Req() req: any) {
    return this.authService.changePassword(body, req.headers);
  }

  @AllowAnonymous()
  @Post('password/validate')
  async validatePassword(@Body() body: any) {
    return this.authService.validatePassword(body);
  }

  @Post('2fa/enable')
  async enable2FA(@Req() req: any) {
    return this.authService.enable2FA(req.headers);
  }

  @Post('2fa/disable')
  async disable2FA(@Req() req: any) {
    return this.authService.disable2FA(req.headers);
  }

  @Post('2fa/verify')
  async verify2FA(@Body() body: any, @Req() req: any) {
    return this.authService.verify2FA(body, req.headers);
  }

  @Get('2fa/qrcode')
  async get2FAQrCode(@Req() req: any) {
    return this.authService.get2FAQrCode(req.headers);
  }

  @Post('2fa/recovery-codes')
  async get2FARecoveryCodes(@Req() req: any) {
    return this.authService.get2FARecoveryCodes(req.headers);
  }

  @Get('sessions')
  async getSessions(@Req() req: any) {
    return this.authService.getSessions(req.headers);
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string, @Req() req: any) {
    return this.authService.deleteSession(id, req.headers);
  }

  @Delete('sessions')
  async clearAllSessions(@Req() req: any) {
    return this.authService.clearAllSessions(req.headers);
  }

  @Post('sessions/revoke')
  async revokeSession(@Body() body: any, @Req() req: any) {
    return this.authService.revokeSession(body, req.headers);
  }

  // Reports
  @Get('reports/funnel')
  async getFunnelReport() {
    return this.authService.getRegistrationFunnelReport();
  }

  @Get('reports/otp-success')
  async getOtpSuccessReport() {
    return this.authService.getOtpSuccessReport();
  }

  @Get('reports/security-events')
  async getSecurityEventsReport() {
    return this.authService.getSecurityEventsReport();
  }
}
