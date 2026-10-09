import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { hashPassword as betterAuthHash } from 'better-auth/crypto';
import { validateEthiopianMobilePrefix } from './phone.util';
import { SessionTokenService } from '../services/session-token.service';
import { RegisterClientDto } from '../dto/auth.dto';

export async function processClientRegistrationTransaction(
  tx: any,
  data: Partial<RegisterClientDto>,
  sessionTokenService: SessionTokenService
) {
  data = data || {};
  const phone = validateEthiopianMobilePrefix(data.phone);

  const hasSmsToken = !!data.otpContinuationToken;
  const hasEmailToken = !!(data.emailContinuationToken || data.emailToken);

  if (!hasSmsToken && !hasEmailToken) {
    throw new BadRequestException({
      code: 'VERIFICATION_REQUIRED',
      message:
        'Verification token required: Provide either otpContinuationToken (SMS) or emailContinuationToken (Email)',
    });
  }

  let isPhoneVerified = false;
  let isEmailVerified = false;

  if (hasSmsToken) {
    const otpRecord = await tx.otpCode.findUnique({
      where: { continuationToken: data.otpContinuationToken },
    });

    if (!otpRecord || otpRecord.usedAt || otpRecord.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Invalid or expired OTP continuation token. Please verify your phone number again.',
      });
    }

    isPhoneVerified = true;
    await tx.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });
  }

  // Validate Email OTP continuation token inside tx if provided
  const emailToken = data.emailContinuationToken || data.emailToken;
  if (emailToken) {
    const emailRecord = await tx.verification.findFirst({
      where: { value: emailToken },
    });

    if (!emailRecord) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Invalid or expired email continuation token. Please verify your email again.',
      });
    }

    if (emailRecord.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'TOKEN_EXPIRED',
        message: 'Email continuation token has expired. Please verify your email again.',
      });
    }

    if (data.email && emailRecord.identifier.toLowerCase() !== data.email.trim().toLowerCase()) {
      throw new BadRequestException({
        code: 'EMAIL_TOKEN_MISMATCH',
        message: 'Email address does not match the verified email continuation token',
      });
    }

    isEmailVerified = true;
  }

  // ONE_PHONE_PER_ROLE rule check: Same phone + Client role
  const existingClient = await tx.user.findFirst({
    where: { phone, role: 'CLIENT' },
  });

  if (existingClient) {
    throw new HttpException(
      {
        code: 'PHONE_ALREADY_EXISTS',
        message: 'A Client account with this phone number already exists',
      },
      HttpStatus.CONFLICT
    );
  }

  if (data.email) {
    const existingEmailUser = await tx.user.findFirst({
      where: { email: data.email.trim().toLowerCase() },
    });
    if (existingEmailUser) {
      throw new HttpException(
        {
          code: 'EMAIL_ALREADY_EXISTS',
          message:
            'An account with this email address already exists. Please log in or reset your password.',
          email: data.email,
        },
        HttpStatus.CONFLICT
      );
    }
  }

  const hashedPassword = data.password ? await betterAuthHash(data.password) : null;
  const clientName =
    (data.name || `${data.firstName || ''} ${data.lastName || ''}`).trim() || 'Client User';

  const user = await tx.user.create({
    data: {
      phone,
      email: data.email || `${phone.replace('+', '')}@client.tebeka.et`,
      name: clientName,
      passwordHash: hashedPassword,
      role: 'CLIENT',
      status: 'ACTIVE',
      marketingConsent: data.marketingConsent ?? false,
      phoneVerified: isPhoneVerified,
      emailVerified: isEmailVerified,
    },
  });

  if (hashedPassword) {
    await tx.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: 'credential',
        password: hashedPassword,
      },
    });
  }

  const { accessToken, refreshToken } = await sessionTokenService.issueTokenPair(tx, user);

  return { user, token: accessToken, refreshToken };
}
