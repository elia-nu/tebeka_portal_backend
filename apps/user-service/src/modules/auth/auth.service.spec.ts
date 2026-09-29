jest.mock('better-auth/crypto', () => ({
  hashPassword: jest.fn().mockImplementation(async (pwd: string) => `hashed_${pwd}`),
  verifyPassword: jest.fn().mockImplementation(async ({ password, hash }: any) => hash === `hashed_${password}`),
}));
jest.mock('better-auth', () => ({
  betterAuth: jest.fn().mockReturnValue({
    api: {},
  }),
}));
jest.mock('better-auth/plugins', () => ({
  admin: jest.fn(),
  twoFactor: jest.fn(),
  phoneNumber: jest.fn(),
  emailOTP: jest.fn(),
  bearer: jest.fn(),
  multiSession: jest.fn(),
}));
jest.mock('@better-auth/prisma-adapter', () => ({
  prismaAdapter: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { OtpService } from './services/otp.service';
import { RegistrationService } from './services/registration.service';
import { PrismaService } from '@workspace/database';
import { CacheService } from '@workspace/cache';
import { SmsService } from '@workspace/sms';
import { AppLoggerService } from '@workspace/logger';
import { SessionTokenService } from './services/session-token.service';
import { EmailVerificationService } from './services/email-verification.service';

describe('Auth & Registration Service (FR-AUTH Unit Tests)', () => {
  let otpService: OtpService;
  let registrationService: RegistrationService;
  let cacheService: CacheService;
  let prismaService: PrismaService;

  const mockUsers: any[] = [];
  const mockOtpCodes: any[] = [];
  const mockCache = new Map<string, any>();

  beforeEach(async () => {
    mockUsers.length = 0;
    mockOtpCodes.length = 0;
    mockCache.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        RegistrationService,
        {
          provide: PrismaService,
          useValue: {
            otpCode: {
              create: jest.fn().mockImplementation(({ data }) => {
                const record = { id: `otp-${Date.now()}`, attempts: 0, usedAt: null, ...data };
                mockOtpCodes.push(record);
                return record;
              }),
              findFirst: jest.fn().mockImplementation(({ where }) => {
                return mockOtpCodes.find(o => o.phone === where.phone && (!where.usedAt || o.usedAt === null)) || null;
              }),
              findUnique: jest.fn().mockImplementation(({ where }) => {
                return mockOtpCodes.find(o => o.continuationToken === where.continuationToken) || null;
              }),
              update: jest.fn().mockImplementation(({ where, data }) => {
                const record = mockOtpCodes.find(o => o.id === where.id);
                if (record) Object.assign(record, data);
                return record;
              }),
              updateMany: jest.fn().mockImplementation(({ where, data }) => {
                const record = mockOtpCodes.find(o => o.id === where.id);
                if (record) {
                  Object.assign(record, data);
                  return { count: 1 };
                }
                return { count: 0 };
              }),
            },
            user: {
              findFirst: jest.fn().mockImplementation(({ where }) => {
                return mockUsers.find(u => {
                  if (where.phone && where.role) return u.phone === where.phone && u.role === where.role;
                  if (where.email) return u.email === where.email;
                  return false;
                }) || null;
              }),
              create: jest.fn().mockImplementation(({ data }) => {
                const user = { id: `usr-${Date.now()}-${Math.random()}`, ...data };
                mockUsers.push(user);
                return user;
              }),
            },
            attorneyProfile: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockImplementation(({ data }) => ({ id: `att-${Date.now()}`, ...data })),
            },
            clientProfile: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockImplementation(({ data }) => ({ id: `clt-${Date.now()}`, ...data })),
            },
            verificationCase: {
              create: jest.fn().mockImplementation(({ data }) => ({ id: `vcase-${Date.now()}`, ...data })),
            },
            verificationChecklist: {
              createMany: jest.fn().mockResolvedValue({ count: 4 }),
            },
            guardedChange: {
              create: jest.fn().mockResolvedValue({ id: 'gc-1' }),
            },
            account: {
              create: jest.fn().mockResolvedValue({ id: 'acc-1' }),
            },
            verification: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            $transaction: jest.fn().mockImplementation(async (callback) => {
              return callback(prismaService);
            }),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockImplementation((key) => mockCache.get(key) || null),
            set: jest.fn().mockImplementation((key, val) => {
              mockCache.set(key, val);
              return true;
            }),
            incrWithExpiry: jest.fn().mockImplementation((key) => {
              const current = (mockCache.get(key) || 0) + 1;
              mockCache.set(key, current);
              return current;
            }),
          },
        },
        {
          provide: SmsService,
          useValue: {
            sendOtp: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: SessionTokenService,
          useValue: {
            issueTokenPair: jest.fn().mockResolvedValue({
              accessToken: 'mock_access_jwt',
              refreshToken: 'mock_refresh_jwt',
            }),
          },
        },
        {
          provide: EmailVerificationService,
          useValue: {
            sendEmailVerification: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: AppLoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    otpService = module.get<OtpService>(OtpService);
    registrationService = module.get<RegistrationService>(RegistrationService);
    cacheService = module.get<CacheService>(CacheService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('TC-AUTH-01 & TC-AUTH-02: ONE_PHONE_PER_ROLE Multi-Persona Model', () => {
    it('should allow the same phone number to register once as CLIENT and once as ATTORNEY', async () => {
      const phone = '+251911223344';
      const continuationTokenClient = 'client_token_123';
      const continuationTokenAttorney = 'attorney_token_456';

      mockOtpCodes.push(
        { id: 'otp-c', phone, continuationToken: continuationTokenClient, expiresAt: new Date(Date.now() + 600000), usedAt: null },
        { id: 'otp-a', phone, continuationToken: continuationTokenAttorney, expiresAt: new Date(Date.now() + 600000), usedAt: null },
      );

      // 1. Register as CLIENT
      const clientRes = await registrationService.registerClient({
        phone,
        firstName: 'Dawit',
        lastName: 'Kebede',
        otpContinuationToken: continuationTokenClient,
      });

      expect(clientRes.status).toBe('success');
      expect(clientRes.user.role).toBe('CLIENT');
      expect(clientRes.user.phone).toBe(phone);

      // 2. Register same phone as ATTORNEY with mandatory attorney email
      const attorneyRes = await registrationService.registerAttorney({
        phone,
        email: 'dawit.law@tebeka.et',
        firstName: 'Dawit',
        lastName: 'Kebede',
        barRegistrationNumber: 'ET-BAR-2026-9901',
        otpContinuationToken: continuationTokenAttorney,
      });

      expect(attorneyRes.status).toBe('success');
      expect(attorneyRes.user.role).toBe('ATTORNEY');
      expect(attorneyRes.user.phone).toBe(phone);
      expect(mockUsers.length).toBe(2);
    });

    it('should reject duplicate registration for same phone with identical role (TC-AUTH-02)', async () => {
      const phone = '+251911334455';
      const contToken1 = 'token_1';
      const contToken2 = 'token_2';

      mockOtpCodes.push(
        { id: 'otp-1', phone, continuationToken: contToken1, expiresAt: new Date(Date.now() + 600000), usedAt: null },
        { id: 'otp-2', phone, continuationToken: contToken2, expiresAt: new Date(Date.now() + 600000), usedAt: null },
      );

      // Register first time as CLIENT
      await registrationService.registerClient({
        phone,
        name: 'First Client',
        otpContinuationToken: contToken1,
      });

      // Attempt second registration with same phone as CLIENT
      try {
        await registrationService.registerClient({
          phone,
          name: 'Duplicate Client',
          otpContinuationToken: contToken2,
        });
        fail('Should have thrown HTTP 409 Conflict');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(err.getResponse().code).toBe('PHONE_ALREADY_EXISTS');
      }
    });
  });

  describe('TC-AUTH-03: Scoped Continuation Token Invariant', () => {
    it('should reject registration calls without a valid continuation token', async () => {
      await expect(registrationService.registerClient({
        phone: '+251911556677',
        name: 'No Token User',
      })).rejects.toThrow(BadRequestException);
    });

    it('should reject registration when continuation token is expired or used', async () => {
      const phone = '+251911556677';
      const expiredToken = 'expired_token';
      mockOtpCodes.push({
        id: 'otp-exp',
        phone,
        continuationToken: expiredToken,
        expiresAt: new Date(Date.now() - 10000), // Expired
        usedAt: null,
      });

      await expect(registrationService.registerClient({
        phone,
        name: 'Expired Token User',
        otpContinuationToken: expiredToken,
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('TC-AUTH-04: OTP Rate Limiting & Cooldowns', () => {
    it('should enforce 60s resend cooldown', async () => {
      const phone = '+251911778899';
      await otpService.requestOtp({ phone, purpose: 'REGISTRATION' });

      // Immediate second request must be blocked by cooldown
      await expect(otpService.requestOtp({ phone, purpose: 'REGISTRATION' }))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should reject 6th OTP request within 1 hour for same number (Hourly Cap)', async () => {
      const phone = '+251911889900';
      mockCache.set(`otp:reqcount:${phone}`, 5); // 5 requests already sent

      await expect(otpService.requestOtp({ phone, purpose: 'REGISTRATION' }))
        .rejects
        .toThrow(HttpException);

      try {
        await otpService.requestOtp({ phone, purpose: 'REGISTRATION' });
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.getResponse().code).toBe('OTP_RATE_LIMIT_EXCEEDED');
      }
    });
  });

  describe('Ethiopian Phone Prefix Validation', () => {
    it('should reject non-Ethiopian or invalid mobile prefixes', async () => {
      await expect(otpService.requestOtp({ phone: '+12025550199' }))
        .rejects
        .toThrow(BadRequestException);

      await expect(otpService.requestOtp({ phone: '+251111223344' })) // Landline prefix 011
        .rejects
        .toThrow(BadRequestException);
    });

    it('should accept valid Ethiopian mobile prefixes (+2519 and +2517)', async () => {
      const res9 = await otpService.requestOtp({ phone: '+251911223344' });
      expect(res9.status).toBe('success');

      mockCache.clear();
      const res7 = await otpService.requestOtp({ phone: '+251711223344' });
      expect(res7.status).toBe('success');
    });
  });
});
