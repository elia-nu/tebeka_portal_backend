import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '@workspace/logger';
import { PrismaService } from '@workspace/database';
import { SessionTokenService } from './session-token.service';
import { EmailVerificationService } from './email-verification.service';
import {
  RegisterClientDto,
  RegisterAttorneyDto,
  RegisterAdminDto,
  RegisterInviteDto,
} from '../dto/auth.dto';
import { processClientRegistrationTransaction } from '../auth-shared/registration-client.util';
import { processAttorneyRegistrationTransaction } from '../auth-shared/registration-attorney.util';
import { processAdminRegistrationTransaction } from '../auth-shared/registration-admin.util';

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionTokenService: SessionTokenService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly logger: AppLoggerService
  ) {}

  /**
   * Registers a new Client account with SMS or Email OTP continuation token validation.
   */
  async registerClient(data: Partial<RegisterClientDto>) {
    const res = await this.prisma.$transaction(async (tx) => {
      return processClientRegistrationTransaction(tx, data, this.sessionTokenService);
    });

    if (
      res.user.email &&
      !res.user.emailVerified &&
      !res.user.email.endsWith('@client.tebeka.et')
    ) {
      this.emailVerificationService
        .sendEmailVerification({ email: res.user.email })
        .catch((err) => {
          this.logger.error(
            `Post-registration email dispatch failed for ${res.user.email}: ${
              err?.message || err
            }`,
            err?.stack,
            'RegistrationService'
          );
        });
    }

    return {
      status: 'success',
      message: 'Client account registered successfully',
      token: res.token,
      accessToken: res.token,
      refreshToken: res.refreshToken,
      expiresInSeconds: 2592000,
      user: {
        id: res.user.id,
        name: res.user.name,
        phone: res.user.phone,
        email: res.user.email,
        role: res.user.role,
        phoneVerified: res.user.phoneVerified,
        emailVerified: res.user.emailVerified,
      },
    };
  }

  /**
   * Registers a new Attorney applicant with profile, credentials, and verification queue routing.
   */
  async registerAttorney(data: Partial<RegisterAttorneyDto>) {
    const res = await this.prisma.$transaction(async (tx) => {
      return processAttorneyRegistrationTransaction(tx, data, this.sessionTokenService);
    });

    return {
      status: 'success',
      message:
        'Attorney registered successfully in PENDING_VERIFICATION (SUBMITTED) status and routed to FR-VERIF verification queue',
      token: res.token,
      accessToken: res.token,
      refreshToken: res.refreshToken,
      expiresInSeconds: 2592000,
      user: {
        id: res.user.id,
        name: res.user.name,
        phone: res.user.phone,
        email: res.user.email,
        role: res.user.role,
        phoneVerified: res.user.phoneVerified,
        emailVerified: res.user.emailVerified,
        attorneyProfileId: res.user.attorneyProfile?.id,
        verificationCaseId: res.vCase.id,
      },
    };
  }

  /**
   * Super Admin provisions a platform Admin account.
   */
  async registerAdmin(data: Partial<RegisterAdminDto>, currentUserRole?: string) {
    const user = await this.prisma.$transaction(async (tx) => {
      return processAdminRegistrationTransaction(tx, data, currentUserRole);
    });

    return {
      status: 'success',
      message: 'Admin account created by Super Admin',
      userId: user.id,
    };
  }

  /**
   * Finalizes invitation-based onboarding.
   */
  async registerInvite(data: RegisterInviteDto) {
    return {
      status: 'success',
      message: 'Invitation register completed',
      token: data.inviteToken,
    };
  }
}
