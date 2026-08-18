import { Injectable } from '@nestjs/common';
import { CacheService } from '@workspace/cache';
import { prisma } from '../auth-shared/prisma';

@Injectable()
export class AuthReportsService {
  private prisma = prisma;

  constructor(private readonly cacheService: CacheService) {}

  async getRegistrationFunnelReport() {
    const [otpRequested, otpVerified, clientRegistered, attorneyDraft, attorneyVerified] = await Promise.all([
      this.prisma.otpCode.count(),
      this.prisma.otpCode.count({ where: { continuationToken: { not: null } } }),
      this.prisma.user.count({ where: { role: 'CLIENT' } }),
      this.prisma.attorneyProfile.count(),
      this.prisma.verificationCase.count({ where: { status: 'APPROVED' } }),
    ]);

    const registered = clientRegistered + attorneyDraft;
    const conversionRatePercentage = otpRequested > 0 ? Number(((registered / otpRequested) * 100).toFixed(1)) : 0;

    return {
      funnel: [
        { stage: 'OTP_REQUESTED', count: otpRequested },
        { stage: 'OTP_VERIFIED', count: otpVerified },
        { stage: 'CLIENT_REGISTERED', count: clientRegistered },
        { stage: 'ATTORNEY_REGISTERED_DRAFT', count: attorneyDraft },
        { stage: 'ATTORNEY_VERIFIED', count: attorneyVerified },
      ],
      conversionRatePercentage,
    };
  }

  async getOtpSuccessReport() {
    const [totalRequested, totalVerified, attemptsAgg] = await Promise.all([
      this.prisma.otpCode.count(),
      this.prisma.otpCode.count({ where: { continuationToken: { not: null } } }),
      this.prisma.otpCode.aggregate({ _sum: { attempts: true } }),
    ]);

    // "Delivery" success can only be observed via the AfroMessage dispatch response,
    // which isn't currently persisted per-OTP - this is a verification-rate proxy,
    // not a true SMS delivery receipt rate. See OtpService.requestOtp()'s dispatch logging.
    const verificationRatePercentage = totalRequested > 0 ? Number(((totalVerified / totalRequested) * 100).toFixed(1)) : 0;

    return {
      totalRequested,
      totalVerified,
      failedAttemptsCount: attemptsAgg._sum.attempts || 0,
      verificationRatePercentage,
    };
  }

  async getSecurityEventsReport() {
    const [lockedAccountKeys, bruteForceBlockedOtpCount, tokenReuseCount] = await Promise.all([
      this.cacheService.keys('auth:lockuntil:*'),
      this.prisma.otpCode.count({ where: { attempts: { gte: 3 } } }),
      this.cacheService.get<number>('security:token_reuse_count'),
    ]);

    return {
      lockedAccountsCount: lockedAccountKeys.length,
      bruteForceAttemptsBlocked: bruteForceBlockedOtpCount,
      tokenReuseDetections: tokenReuseCount || 0,
      // No signing-key-rotation process exists yet - report as untracked rather than fabricate a schedule.
      signingKeyRotationStatus: null,
    };
  }
}
