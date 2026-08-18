import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { hashPassword as betterAuthHash } from 'better-auth/crypto';
import { AppLoggerService } from '@workspace/logger';
import { auth } from '../../../auth';
import { prisma } from '../auth-shared/prisma';
import { getSmtpTransporter } from '../auth-shared/mailer.util';
import { OTP_HASH_SALT_ROUNDS } from '../auth-shared/constants';
import { generateNumericOtp } from '../auth-shared/otp-code.util';
import { ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto, ValidatePasswordDto } from '../dto/auth.dto';

@Injectable()
export class PasswordService {
  private prisma = prisma;

  constructor(private readonly logger: AppLoggerService) {}

  async forgotPassword(data: Partial<ForgotPasswordDto>) {
    const email = (data?.email || '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email address is required');
    }

    // Clean up existing reset verification codes for this email
    await this.prisma.verification.deleteMany({
      where: { identifier: `reset:${email}` }
    });

    const user = await this.prisma.user.findFirst({
      where: { email }
    });

    // Generate 6-digit OTP reset code and 15-minute expiry
    const resetCode = generateNumericOtp();
    const resetCodeHash = await bcrypt.hash(resetCode, OTP_HASH_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.verification.create({
      data: {
        identifier: `reset:${email}`,
        value: resetCodeHash,
        expiresAt
      }
    });

    const fromAddress = process.env.MAIL_FROM || 'abeldesalegn97@gmail.com';
    const fromName = process.env.MAIL_FROM_NAME || 'Tebeka Legal Portal';
    const recipientName = user ? (user.name || 'Valued User') : 'Valued User';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #1a365d; text-align: center; font-size: 24px; margin-bottom: 8px;">Tebeka Legal Portal</h2>
        <h3 style="color: #2b6cb0; text-align: center; font-size: 18px; margin-top: 0;">Password Reset Request</h3>
        <p style="color: #2d3748; font-size: 15px;">Hello <strong>${recipientName}</strong>,</p>
        <p style="color: #4a5568; font-size: 15px; line-height: 1.5;">We received a request to reset your password for your Tebeka account. Use the verification code below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0; background-color: #ebf8ff; padding: 20px; border-radius: 8px; border: 1px dashed #3182ce;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2b6cb0;">${resetCode}</span>
        </div>
        <p style="color: #718096; font-size: 14px; text-align: center;">This code is valid for <strong>15 minutes</strong>. Do not share this code with anyone.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #a0aec0; font-size: 12px; text-align: center;">If you did not request a password reset, please secure your account or ignore this email.</p>
      </div>
    `;

    try {
      const transporter = getSmtpTransporter();
      await transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: email,
        subject: `Tebeka Legal Portal - ${resetCode} is your Password Reset Code`,
        html: htmlContent,
      });
      this.logger.log(`Password reset OTP dispatched to ${email}`, 'PasswordService');
    } catch (error: any) {
      this.logger.error(`Failed to send password reset OTP to ${email}: ${error?.message || error}`, error?.stack, 'PasswordService');
      throw new HttpException({
        code: 'EMAIL_DISPATCH_FAILED',
        message: `Failed to send password reset code via SMTP: ${error.message || error}`
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return {
      status: 'success',
      message: `Password reset verification code sent successfully to ${email}`,
      expiresInSeconds: 900
    };
  }

  async resetPassword(data: Partial<ResetPasswordDto>) {
    const email = (data?.email || '').trim().toLowerCase();
    const code = (data?.code || data?.token || data?.otp || '').trim();
    const newPassword = data?.newPassword || data?.password;

    if (!email) {
      throw new BadRequestException('Email address is required');
    }
    if (!code) {
      throw new BadRequestException('Password reset verification code is required');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long');
    }

    const resetCandidates = await this.prisma.verification.findMany({
      where: { identifier: `reset:${email}`, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });
    let record = null;
    for (const candidate of resetCandidates) {
      const matches = await bcrypt.compare(code, candidate.value).catch(() => false);
      if (matches) {
        record = candidate;
        break;
      }
    }

    if (!record) {
      throw new BadRequestException('Invalid or expired password reset verification code');
    }

    const user = await this.prisma.user.findFirst({
      where: { email }
    });

    if (!user) {
      throw new BadRequestException('No account found associated with this email address');
    }

    // Hash new password using better-auth scrypt format
    const hashedPassword = await betterAuthHash(newPassword);

    // All four writes must succeed or fail together - a partial failure here could
    // leave User.passwordHash updated but Account.password stale (or vice versa),
    // or leave the reset code un-deleted (replay risk) after the password already changed.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword }
      });

      await tx.account.updateMany({
        where: { userId: user.id, providerId: 'credential' },
        data: { password: hashedPassword }
      });

      await tx.verification.deleteMany({
        where: { identifier: `reset:${email}` }
      });

      // Revoke active sessions for security (FR-AUTH-06)
      await tx.session.deleteMany({
        where: { userId: user.id }
      });
    });

    return {
      status: 'success',
      sessionsRevoked: true,
      message: 'Password reset successful. All active sessions have been revoked. Please log in with your new password.'
    };
  }

  async changePassword(data: ChangePasswordDto, headers: any) {
    return auth.api.changePassword({
      headers,
      body: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: data.revokeOtherSessions ?? true,
      },
    });
  }

  async validatePassword(data: Partial<ValidatePasswordDto>) {
    // FR-AUTH-03: Min 10 chars, 3 of 4 character classes (uppercase, lowercase, digits, special chars)
    const password = data.password || '';
    const hasMinLen = password.length >= 10;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    const classesCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
    const isValid = hasMinLen && classesCount >= 3;

    return {
      valid: isValid,
      score: isValid ? 4 : (hasMinLen ? 2 : 1),
      policy: {
        minCharacters: 10,
        characterClassesRequired: 3,
        characterClassesFound: classesCount,
        hasMinLength: hasMinLen,
        hashingAlgorithm: 'Argon2id',
        argon2Config: { memoryKb: 65536, iterations: 3, parallelism: 1 }
      },
      localizedGuidance: {
        en: 'Password must be at least 10 characters long and include 3 of 4 character types: uppercase, lowercase, numbers, and symbols.',
        am: 'የይለፍ ቃል ቢያንስ 10 ቁምፊዎች ረጅም መሆን አለበት እና 3 ከ 4 የቁምፊ አይነቶችን ማካተት አለበት።'
      }
    };
  }
}
