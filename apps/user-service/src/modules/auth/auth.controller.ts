import { Controller, Post, Get, Delete, Body, Req, Param, Query, HttpCode, HttpStatus, UsePipes, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { createMulterOptions } from '@workspace/storage';
import { relative, resolve } from 'path';
import { RegistrationService } from './services/registration.service';
import { OtpService } from './services/otp.service';
import { LoginService } from './services/login.service';
import { SessionTokenService } from './services/session-token.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordService } from './services/password.service';
import { TwoFactorService } from './services/two-factor.service';
import { AuthReportsService } from './services/auth-reports.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import {
  RegisterClientDto,
  RegisterClientSchema,
  RegisterAttorneyDto,
  RegisterAttorneySchema,
  SendPhoneOtpDto,
  SendPhoneOtpSchema,
  VerifyPhoneOtpDto,
  VerifyPhoneOtpSchema,
  SendEmailOtpDto,
  SendEmailOtpSchema,
  VerifyEmailOtpDto,
  VerifyEmailOtpSchema,
  ForgotPasswordDto,
  ForgotPasswordSchema,
  ResetPasswordDto,
  ResetPasswordSchema,
  Verify2FaDto,
  Verify2FaSchema,
  RefreshTokenDto,
  RefreshTokenSchema,
} from './dto/auth.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

const CREDENTIAL_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const CREDENTIAL_MAX_SIZE = 10 * 1024 * 1024; // 10MB

@AllowAnonymous()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly otpService: OtpService,
    private readonly loginService: LoginService,
    private readonly sessionTokenService: SessionTokenService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordService: PasswordService,
    private readonly twoFactorService: TwoFactorService,
    private readonly authReportsService: AuthReportsService,
  ) {}

  @AllowAnonymous()
  @Post('register')
  @UseInterceptors(AnyFilesInterceptor(createMulterOptions('credentials', CREDENTIAL_MAX_SIZE, CREDENTIAL_ALLOWED_TYPES)))
  async registerUnified(
    @UploadedFiles() files: any[],
    @Body() body: any,
    @Req() req: any,
    @Query() query: any
  ) {
    if (body?.role === 'ATTORNEY') {
      return this.registerAttorney(files, body, req, query);
    }
    return this.registerClient(body, req, query);
  }

  @AllowAnonymous()
  @Post('register/client')
  async registerClient(
    @Body(new JoiValidationPipe(RegisterClientSchema)) body: RegisterClientDto,
    @Req() req: any,
    @Query() query: any
  ) {
    const headerToken = req.headers['x-otp-continuation-token'] || req.headers['x-continuation-token'];
    const queryToken = query?.otpContinuationToken || query?.continuationToken;
    const otpContinuationToken = headerToken || queryToken || (body as any)?.otpContinuationToken;

    const emailHeaderToken = req.headers['x-email-continuation-token'];
    const emailContinuationToken = emailHeaderToken || query?.emailContinuationToken || (body as any)?.emailContinuationToken;

    return this.registrationService.registerClient({ ...body, otpContinuationToken, emailContinuationToken });
  }

  @AllowAnonymous()
  @Post('register/attorney')
  @UseInterceptors(AnyFilesInterceptor(createMulterOptions('credentials', CREDENTIAL_MAX_SIZE, CREDENTIAL_ALLOWED_TYPES)))
  async registerAttorney(
    @UploadedFiles() files: any[],
    @Body() rawBody: any,
    @Req() req: any,
    @Query() query: any
  ) {
    const body = new JoiValidationPipe(RegisterAttorneySchema).transform(rawBody, { type: 'body' });

    const headerToken = req.headers['x-otp-continuation-token'] || req.headers['x-continuation-token'];
    const queryToken = query?.otpContinuationToken || query?.continuationToken;
    const otpContinuationToken = headerToken || queryToken || (body as any)?.otpContinuationToken;

    const emailHeaderToken = req.headers['x-email-continuation-token'];
    const emailContinuationToken = emailHeaderToken || query?.emailContinuationToken || (body as any)?.emailContinuationToken;

    const docUrls: any = {
      otherSupportingDocuments: []
    };
    if (files && files.length > 0) {
      const uploadDir = resolve(process.env.LOCAL_UPLOAD_DIR || './uploads');
      for (const file of files) {
        const relativeKey = relative(uploadDir, file.path).replace(/\\/g, '/');
        const fname = file.fieldname;
        if (fname === 'licenseBook' || fname === 'licenseBookUrl' || fname === 'license') {
          docUrls.licenseBookUrl = relativeKey;
        } else if (fname === 'barRegistration' || fname === 'barRegistrationUrl' || fname === 'barCertificate') {
          docUrls.barRegistrationUrl = relativeKey;
        } else if (
          fname === 'nationalId' ||
          fname === 'nationalIdDocument' ||
          fname === 'nationalIdDocumentUrl' ||
          fname === 'nationalIdFile' ||
          fname === 'nationalIdCard' ||
          fname === 'identityCard' ||
          fname === 'nationalIdKey'
        ) {
          docUrls.nationalIdDocumentUrl = relativeKey;
        } else if (
          fname === 'photo' ||
          fname === 'profilePhoto' ||
          fname === 'profilePicture' ||
          fname === 'profilePic' ||
          fname === 'professionalPhoto' ||
          fname === 'professionalPhotoUrl' ||
          fname === 'photoKey' ||
          fname === 'image' ||
          fname === 'avatar'
        ) {
          docUrls.professionalPhotoUrl = relativeKey;
          docUrls.photoKey = relativeKey;
          docUrls.image = relativeKey;
        } else if (
          fname === 'otherDocuments' ||
          fname === 'supportingDocuments' ||
          fname === 'otherSupportingDocuments' ||
          fname === 'supportingDocument' ||
          fname === 'otherDocument' ||
          fname === 'document' ||
          fname === 'credentials'
        ) {
          docUrls.otherSupportingDocuments.push(relativeKey);
        } else if (
          fname === 'degreeDocument' ||
          fname === 'degreeDocumentUrl' ||
          fname === 'degreeCertificate' ||
          fname === 'academicDocument'
        ) {
          docUrls.degreeDocumentUrl = relativeKey;
        } else {
          if (!docUrls.licenseBookUrl) docUrls.licenseBookUrl = relativeKey;
          else if (!docUrls.barRegistrationUrl) docUrls.barRegistrationUrl = relativeKey;
          else if (!docUrls.nationalIdDocumentUrl) docUrls.nationalIdDocumentUrl = relativeKey;
          else docUrls.otherSupportingDocuments.push(relativeKey);
        }
      }
    }

    return this.registrationService.registerAttorney({ ...body, ...docUrls, otpContinuationToken, emailContinuationToken });
  }

  @Post('register/admin')
  async registerAdmin(@Body() body: any, @Req() req: any) {
    return this.registrationService.registerAdmin(body, req.user?.role);
  }

  @AllowAnonymous()
  @Post('register/invite')
  async registerInvite(@Body() body: any) {
    return this.registrationService.registerInvite(body);
  }

  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @Post('sign-in')
  async login(@Body() body: any) {
    return this.loginService.login(body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @Post('sign-out')
  async logout(@Req() req: any) {
    return this.sessionTokenService.logout(req.headers);
  }

  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @Post('refresh-token')
  @Post('refresh')
  @Post('token/refresh')
  async refreshToken(@Req() req: any, @Body() body?: any) {
    return this.sessionTokenService.refreshToken(body, req.headers);
  }

  @AllowAnonymous()
  @Post('otp/request')
  @Post('request-otp')
  @UsePipes(new JoiValidationPipe(SendPhoneOtpSchema))
  async requestOtp(@Body() body: SendPhoneOtpDto) {
    return this.otpService.requestOtp(body);
  }

  @AllowAnonymous()
  @Post('otp/verify')
  @Post('verify-otp')
  @UsePipes(new JoiValidationPipe(VerifyPhoneOtpSchema))
  async verifyOtp(@Body() body: VerifyPhoneOtpDto) {
    return this.otpService.verifyOtp(body);
  }

  @AllowAnonymous()
  @Post('otp/resend')
  async resendOtp(@Body() body: any) {
    return this.otpService.resendOtp(body);
  }

  @AllowAnonymous()
  @Post('otp/cancel')
  async cancelOtp(@Body() body: any) {
    return this.otpService.cancelOtp(body);
  }

  @AllowAnonymous()
  @Get('email/status')
  @Get('check-email')
  @Get('email-status')
  async checkEmailStatusGet(@Query('email') email: string) {
    return this.emailVerificationService.checkEmailStatus(email);
  }

  @AllowAnonymous()
  @Post('email/status')
  @Post('check-email')
  @Post('email-status')
  async checkEmailStatusPost(@Body() body: { email: string }) {
    return this.emailVerificationService.checkEmailStatus(body?.email);
  }

  @AllowAnonymous()
  @Post('email/request-otp')
  @Post('request-email-otp')
  @Post('email-otp/request')
  @UsePipes(new JoiValidationPipe(SendEmailOtpSchema))
  async requestEmailOtp(@Body() body: SendEmailOtpDto) {
    return this.emailVerificationService.sendEmailVerification(body);
  }

  @AllowAnonymous()
  @Post('email/verify-otp')
  @Post('verify-email-otp')
  @Post('email-otp/verify')
  @UsePipes(new JoiValidationPipe(VerifyEmailOtpSchema))
  async verifyEmailOtp(@Body() body: VerifyEmailOtpDto) {
    return this.emailVerificationService.verifyEmail(body);
  }

  @AllowAnonymous()
  @Post('email/resend-otp')
  @Post('resend-email-otp')
  @Post('email-otp/resend')
  async resendEmailOtp(@Body() body: SendEmailOtpDto) {
    return this.emailVerificationService.resendEmailVerification(body);
  }

  @AllowAnonymous()
  @Post('password/forgot')
  @Post('forgot-password')
  @UsePipes(new JoiValidationPipe(ForgotPasswordSchema))
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.passwordService.forgotPassword(body);
  }

  @AllowAnonymous()
  @Post('password/reset')
  @Post('reset-password')
  @UsePipes(new JoiValidationPipe(ResetPasswordSchema))
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.passwordService.resetPassword(body);
  }

  @Post('password/change')
  async changePassword(@Body() body: any, @Req() req: any) {
    return this.passwordService.changePassword(body, req.headers);
  }

  @AllowAnonymous()
  @Post('password/validate')
  async validatePassword(@Body() body: any) {
    return this.passwordService.validatePassword(body);
  }

  @Post('2fa/enable')
  async enable2FA(@Body() body: any, @Req() req: any) {
    return this.twoFactorService.enable2FA(req.headers, body);
  }

  @Post('2fa/disable')
  async disable2FA(@Body() body: any, @Req() req: any) {
    return this.twoFactorService.disable2FA(req.headers, body);
  }

  @Post('2fa/verify')
  @UsePipes(new JoiValidationPipe(Verify2FaSchema))
  async verify2FA(@Body() body: Verify2FaDto, @Req() req: any) {
    return this.twoFactorService.verify2FA(body, req.headers);
  }

  @Get('2fa/qrcode')
  async get2FAQrCode(@Req() req: any) {
    return this.twoFactorService.get2FAQrCode(req.headers);
  }

  @Post('2fa/recovery-codes')
  async get2FARecoveryCodes(@Req() req: any) {
    return this.twoFactorService.get2FARecoveryCodes(req.headers);
  }

  @Get('sessions')
  async getSessions(@Req() req: any) {
    return this.sessionTokenService.getSessions(req.headers);
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string, @Req() req: any) {
    return this.sessionTokenService.deleteSession(id, req.headers);
  }

  @Delete('sessions')
  async clearAllSessions(@Req() req: any) {
    return this.sessionTokenService.clearAllSessions(req.headers);
  }

  // Auth Reports
  @Get('reports/funnel')
  async getRegistrationFunnelReport() {
    return this.authReportsService.getRegistrationFunnelReport();
  }

  @Get('reports/otp-success')
  async getOtpSuccessReport() {
    return this.authReportsService.getOtpSuccessReport();
  }

  @Get('reports/security-events')
  async getSecurityEventsReport() {
    return this.authReportsService.getSecurityEventsReport();
  }
}
