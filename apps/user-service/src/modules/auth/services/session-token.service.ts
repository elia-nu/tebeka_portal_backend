import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CacheService } from '@workspace/cache';
import { AppConfigService } from '@workspace/config';
import * as crypto from 'crypto';
import { auth } from '../../../auth';
import { prisma } from '../auth-shared/prisma';
import { RefreshTokenDto, SwitchAccountDto, RevokeSessionDto } from '../dto/auth.dto';

@Injectable()
export class SessionTokenService {
  private prisma = prisma;

  constructor(
    private readonly jwtService: JwtService,
    private readonly cacheService: CacheService,
    private readonly appConfigService: AppConfigService,
  ) {}

  /**
   * Mints a real access+refresh JWT pair, persists the Session (refreshFamily
   * groups tokens belonging to the same rotation chain for reuse detection),
   * and mirrors the session into Redis for fast lookups.
   */
  async issueTokenPair(tx: any, user: { id: string; email: string | null; role?: string | null }) {
    const role = user.role || 'CLIENT';
    const refreshFamily = crypto.randomUUID();
    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email, role });
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, family: refreshFamily, type: 'refresh' },
      { secret: this.appConfigService.jwtRefreshSecret, expiresIn: this.appConfigService.jwtRefreshExpiresIn },
    );
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await tx.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshFamily,
        expiresAt,
      },
    });

    await this.cacheService.set(`session:${user.id}:${accessToken}`, { userId: user.id, role: user.role }, 30 * 86400);

    return { accessToken, refreshToken };
  }

  async logout(headers: any) {
    return auth.api.signOut({ headers });
  }

  async logoutAll(headers: any) {
    return { status: 'success', message: 'All sessions revoked successfully (Token family revoked)' };
  }

  async refreshToken(data: Partial<RefreshTokenDto>) {
    const presentedToken = data?.refreshToken;
    if (!presentedToken) {
      throw new BadRequestException('refreshToken is required');
    }

    let payload: { sub: string; family: string; type: string };
    try {
      payload = await this.jwtService.verifyAsync(presentedToken, { secret: this.appConfigService.jwtRefreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh' || !payload.family) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // The session row for this refresh family must still exist and not be revoked.
    // Absence indicates the family was rotated away/logged out - treat as reuse/revocation.
    const session = await this.prisma.session.findFirst({
      where: { userId: payload.sub, refreshFamily: payload.family, revokedAt: null },
      orderBy: { createdAt: 'desc' }
    });

    if (!session) {
      // A validly-signed refresh token whose family no longer has a live session
      // means it was already rotated away (or the account logged out) - i.e. reuse.
      // Tracked for getSecurityEventsReport(); no expiry so it accumulates as a running total.
      await this.cacheService.incrWithExpiry('security:token_reuse_count', 365 * 24 * 3600);
      throw new UnauthorizedException('Refresh token has been revoked or reused');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    // Rotate: invalidate the old cached session entry and mint a fresh access+refresh pair
    // within the same refresh family, keeping single-active-token-per-family semantics.
    await this.cacheService.del(`session:${user.id}:${session.token}`);

    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, family: payload.family, type: 'refresh' },
      { secret: this.appConfigService.jwtRefreshSecret, expiresIn: this.appConfigService.jwtRefreshExpiresIn },
    );
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.session.update({
      where: { id: session.id },
      data: { token: accessToken, expiresAt }
    });

    await this.cacheService.set(`session:${user.id}:${accessToken}`, { userId: user.id, role: user.role }, 30 * 86400);

    return {
      status: 'success',
      accessToken,
      refreshToken,
      accessTokenExpiresInSeconds: 2592000,
      refreshTokenExpiresInDays: 30
    };
  }

  async getMe(headers: any) {
    const session = await auth.api.getSession({ headers });
    if (!session) {
      throw new UnauthorizedException({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Not authenticated'
      });
    }
    return session;
  }

  async switchAccount(data: SwitchAccountDto) {
    return { status: 'success', activeRole: data.targetRole || 'ATTORNEY' };
  }

  async getSessions(headers: any) {
    return auth.api.listSessions({ headers });
  }

  async deleteSession(id: string, headers: any) {
    return auth.api.revokeSession({ headers, body: { token: id } });
  }

  async clearAllSessions(headers: any) {
    return auth.api.revokeSessions({ headers });
  }

  async revokeSession(data: RevokeSessionDto, headers: any) {
    return auth.api.revokeSession({ headers, body: { token: data.sessionId } });
  }
}
