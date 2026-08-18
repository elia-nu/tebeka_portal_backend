import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { admin, twoFactor, phoneNumber, emailOTP, bearer, multiSession } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin(),
    // allowPasswordless: these QR/backup-code endpoints are only reachable behind an
    // already-authenticated session (JwtAuthGuard), so re-prompting for the account
    // password on every fetch isn't required for the security model here.
    twoFactor({ issuer: 'Tebeka', allowPasswordless: true }),
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        // SMS provider dispatch handler (e.g. Telebirr SMS gateway / Twilio / Infobip)
        console.log(`[SMS] Sending OTP ${code} to ${phoneNumber}`);
      },
    }),
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        // Email provider dispatch handler (Nodemailer / SMTP)
        console.log(`[Email] Sending ${type} OTP ${otp} to ${email}`);
      },
    }),
    bearer(),
    multiSession(),
  ],
});
