import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule, AppConfigService } from '@workspace/config';
import { CacheModule } from '@workspace/cache';
import { AuthController } from './auth.controller';
import { RegistrationService } from './services/registration.service';
import { OtpService } from './services/otp.service';
import { LoginService } from './services/login.service';
import { SessionTokenService } from './services/session-token.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordService } from './services/password.service';
import { TwoFactorService } from './services/two-factor.service';
import { AuthReportsService } from './services/auth-reports.service';

@Module({
  imports: [
    AppConfigModule,
    CacheModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtSecret,
        signOptions: { expiresIn: config.jwtExpiresIn || '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegistrationService,
    OtpService,
    LoginService,
    SessionTokenService,
    EmailVerificationService,
    PasswordService,
    TwoFactorService,
    AuthReportsService,
  ],
  exports: [JwtModule],
})
export class UserAuthModule {}
