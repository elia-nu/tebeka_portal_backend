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
    twoFactor({ issuer: 'Tebeka' }),
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
