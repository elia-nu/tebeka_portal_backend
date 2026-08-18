import { Injectable, BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { CacheService } from '@workspace/cache';
import { AppLoggerService } from '@workspace/logger';
import * as bcrypt from 'bcrypt';
import { verifyPassword as betterAuthVerify } from 'better-auth/crypto';
import { auth } from '../../../auth';
import { prisma } from '../auth-shared/prisma';
import { SessionTokenService } from './session-token.service';
import { LoginDto } from '../dto/auth.dto';

@Injectable()
export class LoginService {
  private prisma = prisma;

  constructor(
    private readonly cacheService: CacheService,
    private readonly sessionTokenService: SessionTokenService,
    private readonly logger: AppLoggerService,
  ) {}

  async login(data: Partial<LoginDto>) {
    data = data || {};
    const identifier = (data.identifier || data.email || data.phone || '').trim().toLowerCase();
    const password = data.password;

    if (!identifier) {
      throw new BadRequestException('Email address or phone number is required');
    }

    if (!password) {
      throw new BadRequestException('Password is required');
    }

    const lockUntilRaw = await this.cacheService.get<string>(`auth:lockuntil:${identifier}`);
    const lockUntil = lockUntilRaw ? new Date(lockUntilRaw) : null;
    if (lockUntil && lockUntil > new Date()) {
      throw new ForbiddenException({
        code: 'ACCOUNT_LOCKED_PROGRESSIVE',
        message: `Account temporarily locked due to failed login attempts until ${lockUntil.toISOString()}`
      });
    }

    // Find user by email or phone
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
          { phone: identifier.startsWith('+') ? identifier : `+${identifier}` }
        ]
      }
    });

    if (!user) {
      await this.recordFailedAttempt(identifier);
      throw new BadRequestException(`No account found with email address or phone number: ${identifier}`);
    }

    let isPasswordValid = false;

    // 1. Check user.passwordHash if present (try better-auth scrypt format first, then bcrypt fallback)
    if (user.passwordHash) {
      try {
        isPasswordValid = await betterAuthVerify({ hash: user.passwordHash, password });
      } catch {
        // Fallback: hash might be in legacy bcrypt format
        isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      }
    }

    // 2. Check Account table if not matched yet
    if (!isPasswordValid) {
      const accountRecord = await this.prisma.account.findFirst({
        where: { userId: user.id, providerId: 'credential' }
      });
      if (accountRecord && accountRecord.password) {
        try {
          isPasswordValid = await betterAuthVerify({ hash: accountRecord.password, password });
        } catch {
          // Fallback: hash might be in legacy bcrypt format
          isPasswordValid = await bcrypt.compare(password, accountRecord.password);
        }
      }
    }

    // 3. Fallback to BetterAuth signInEmail if email exists
    if (!isPasswordValid && user.email) {
      try {
        const res = await auth.api.signInEmail({
          body: { email: user.email, password },
        });
        if (res) isPasswordValid = true;
      } catch (e: any) {
        // Expected: this is the last of three fallback credential checks, so a
        // failure here just means the credential didn't match via this path either.
        this.logger.debug(`better-auth signInEmail fallback did not match for ${user.email}: ${e?.message || e}`, 'LoginService');
      }
    }

    if (!isPasswordValid) {
      await this.recordFailedAttempt(identifier);
      throw new UnauthorizedException('Invalid email or password');
    }

    // FR-AUTH-07: Mandatory 2FA for Admin roles
    if ((user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && !user.is2faEnabled) {
      return {
        status: 'REQUIRES_2FA_ENROLLMENT',
        requires2FAEnrollment: true,
        message: 'Mandatory 2FA (TOTP) enrollment required for Admin accounts before accessing admin dashboard.',
        enrollmentPath: '/api/v1/auth/2fa/enable',
      };
    }

    await this.cacheService.del(`auth:failedattempts:${identifier}`);
    await this.cacheService.del(`auth:lockuntil:${identifier}`);

    // Mint signed JWT access+refresh token pair & record in Session table + Redis Cache
    const { accessToken: jwtToken, refreshToken } = await this.sessionTokenService.issueTokenPair(this.prisma, user);

    return {
      status: 'success',
      message: 'Login successful',
      token: jwtToken,
      accessToken: jwtToken,
      refreshToken,
      expiresInSeconds: 2592000,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified
      }
    };
  }

  // Redis-backed so lockout state is shared across horizontally-scaled instances
  // and survives restarts. Fails open (no lockout applied) if Redis is unavailable,
  // matching the fail-open behavior of OTP rate limiting.
  private async recordFailedAttempt(identifier: string) {
    const count = await this.cacheService.incrWithExpiry(`auth:failedattempts:${identifier}`, 24 * 3600);
    if (count === null) {
      return;
    }

    let lockMinutes = 0;
    if (count >= 15) lockMinutes = 1440;
    else if (count >= 10) lockMinutes = 60;
    else if (count >= 5) lockMinutes = 15;

    if (lockMinutes > 0) {
      const lockUntil = new Date(Date.now() + lockMinutes * 60000);
      await this.cacheService.set(`auth:lockuntil:${identifier}`, lockUntil.toISOString(), lockMinutes * 60);
    }
  }
}
