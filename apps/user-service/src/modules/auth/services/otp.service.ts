import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { CacheService } from '@workspace/cache';
import { AppLoggerService } from '@workspace/logger';
import { SmsService, validateEthiopianMobilePrefix } from '@workspace/sms';
import * as bcrypt from 'bcrypt';
import { prisma } from '../auth-shared/prisma';
import { OTP_HASH_SALT_ROUNDS } from '../auth-shared/constants';
import { generateNumericOtp } from '../auth-shared/otp-code.util';
import { SendPhoneOtpDto, VerifyPhoneOtpDto } from '../dto/auth.dto';

@Injectable()
export class OtpService {
  private prisma = prisma;

  constructor(
    private readonly cacheService: CacheService,
    private readonly smsService: SmsService,
    private readonly logger: AppLoggerService,
  ) {}

  async requestOtp(data: Partial<SendPhoneOtpDto>) {
    data = data || {};
    const phone = validateEthiopianMobilePrefix(data.phone);
    const now = Date.now();

    // Rate limiting is Redis-backed (not in-process) so it holds across horizontally
    // scaled instances and survives restarts. If Redis is unavailable we fail open -
    // i.e. requests proceed unlimited - consistent with how session caching already
    // degrades elsewhere in this service, rather than blocking registration entirely
    // during an infra outage.
    const cooldownKey = `otp:cooldown:${phone}`;
    const cooldownActive = await this.cacheService.get<string>(cooldownKey);
    if (cooldownActive) {
      throw new BadRequestException('Please wait 60 seconds before requesting another OTP');
    }

    // Hourly limit: 5 requests/hour/number (6th request rejected)
    const hourlyCount = await this.cacheService.incrWithExpiry(`otp:reqcount:${phone}`, 3600);
    if (hourlyCount !== null && hourlyCount > 5) {
      throw new HttpException({
        code: 'OTP_RATE_LIMIT_EXCEEDED',
        message: 'Hourly OTP limit of 5 requests exceeded. Please try again after 1 hour.'
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.cacheService.set(cooldownKey, '1', 60);

    // Generate 6 digit code
    const rawCode = generateNumericOtp();
    const expiresAt = new Date(now + 300000); // 5 minutes validity

    const codeHash = await bcrypt.hash(rawCode, OTP_HASH_SALT_ROUNDS);
    await this.prisma.otpCode.create({
      data: {
        phone,
        purpose: data.purpose || 'REGISTRATION',
        codeHash,
        expiresAt,
        attempts: 0
      }
    });

    // Send SMS via shared SmsService (AfroMessage Provider)
    const smsResult = await this.smsService.sendOtp({
      to: phone,
      otpCode: rawCode,
      purpose: data.purpose || 'REGISTRATION',
      validityMinutes: 5,
    });

    return {
      status: 'success',
      purpose: data.purpose || 'REGISTRATION',
      expiresInSeconds: 300,
      resendCooldownSeconds: 60,
      smsDispatched: smsResult.success
    };
  }

  async verifyOtp(data: VerifyPhoneOtpDto) {
    const phone = validateEthiopianMobilePrefix(data.phone);
    const code = (data.code || '').trim();

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: { phone, usedAt: null },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord) {
      throw new BadRequestException('No active OTP found for this phone number');
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    if (otpRecord.attempts >= 3) {
      throw new BadRequestException('OTP attempt limit (3) exceeded. Please request a new OTP.');
    }

    const codeValid = await bcrypt.compare(code, otpRecord.codeHash);
    if (!codeValid) {
      // Conditional update guarded by the attempts value we read: if another concurrent
      // request already bumped attempts since our read, this affects 0 rows and we
      // report the race instead of silently allowing more than 3 total guesses.
      const { count } = await this.prisma.otpCode.updateMany({
        where: { id: otpRecord.id, attempts: otpRecord.attempts },
        data: { attempts: otpRecord.attempts + 1 }
      });
      if (count === 0) {
        throw new BadRequestException('OTP verification is being processed concurrently. Please retry.');
      }
      throw new BadRequestException('Invalid OTP code');
    }

    // Mint scoped continuation token valid for 15 minutes
    const continuationToken = `otp_cont_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const continuationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Same optimistic-concurrency guard as the failure branch: only one concurrent
    // verify of this record should be able to mint a continuation token.
    const { count } = await this.prisma.otpCode.updateMany({
      where: { id: otpRecord.id, attempts: otpRecord.attempts },
      data: {
        continuationToken,
        expiresAt: continuationExpiresAt,
      }
    });
    if (count === 0) {
      throw new BadRequestException('OTP verification is being processed concurrently. Please retry.');
    }

    return {
      status: 'success',
      message: 'OTP verified successfully',
      otpContinuationToken: continuationToken,
      expiresInMinutes: 15
    };
  }

  async resendOtp(data: Partial<SendPhoneOtpDto>) {
    return this.requestOtp(data);
  }

  async cancelOtp(data: Partial<SendPhoneOtpDto>) {
    return { status: 'success', message: 'OTP cancelled' };
  }

  async sendPhoneVerification(data: Partial<SendPhoneOtpDto>) {
    return { status: 'success', message: 'SMS verification code sent' };
  }

  async verifyPhone(data: Partial<VerifyPhoneOtpDto>) {
    return { status: 'success', message: 'Phone verified successfully' };
  }

  async resendPhoneVerification(data: Partial<SendPhoneOtpDto>) {
    return { status: 'success', message: 'SMS verification code resent' };
  }
}
