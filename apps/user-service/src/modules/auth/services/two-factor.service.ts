import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { auth } from '../../../auth';
import { TwoFactorPasswordDto, Verify2FaDto } from '../dto/auth.dto';

@Injectable()
export class TwoFactorService {
  async enable2FA(headers: any, body?: Partial<TwoFactorPasswordDto>) {
    const password = body?.password;
    if (!password) {
      throw new BadRequestException('Password is required to enable 2FA');
    }
    try {
      return await auth.api.enableTwoFactor({ headers, body: { password } });
    } catch (err: any) {
      if (err?.message?.includes('Invalid password') || err?.status === 400) {
        throw new BadRequestException('Incorrect account password');
      }
      throw err;
    }
  }

  async disable2FA(headers: any, body?: Partial<TwoFactorPasswordDto>) {
    const password = body?.password;
    if (!password) {
      throw new BadRequestException('Password is required to disable 2FA');
    }
    try {
      return await auth.api.disableTwoFactor({ headers, body: { password } });
    } catch (err: any) {
      if (err?.message?.includes('Invalid password') || err?.status === 400) {
        throw new BadRequestException('Incorrect account password');
      }
      throw err;
    }
  }

  async verify2FA(data: Partial<Verify2FaDto>, headers: any) {
    const code = (data?.code || data?.otp || data?.totpCode || '').trim();
    if (!code) {
      throw new BadRequestException('2FA verification code (6-digit TOTP) is required');
    }
    try {
      return await auth.api.verifyTwoFactorOTP({ headers, body: { code } });
    } catch (err: any) {
      if (err?.message?.includes('Invalid') || err?.message?.includes('expired') || err?.status === 400) {
        throw new BadRequestException('Invalid or expired 2FA verification code');
      }
      throw err;
    }
  }

  async get2FAQrCode(headers: any) {
    try {
      const result: any = await auth.api.getTOTPURI({ headers, body: {} });
      return { qrCodeUrl: result.totpURI };
    } catch (err: any) {
      if (err?.status === 400 || err?.message?.includes('TOTP')) {
        throw new BadRequestException('2FA is not enabled for this account. Call /2fa/enable first.');
      }
      throw err;
    }
  }

  async get2FARecoveryCodes(headers: any) {
    const session = await auth.api.getSession({ headers });
    if (!session?.user?.id) {
      throw new UnauthorizedException({ code: 'AUTH_UNAUTHORIZED', message: 'Not authenticated' });
    }
    try {
      const result: any = await auth.api.viewBackupCodes({ body: { userId: session.user.id } });
      return { recoveryCodes: result.backupCodes };
    } catch (err: any) {
      if (err?.status === 400 || err?.message?.includes('backup')) {
        throw new BadRequestException('2FA backup codes are not enabled for this account. Call /2fa/enable first.');
      }
      throw err;
    }
  }
}
