import { Test, TestingModule } from '@nestjs/testing';
import { UsersService, sanitizeUser } from './users.service';
import { PrismaService } from '@workspace/database';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      session: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sanitizeUser', () => {
    it('should strip passwordHash, otpHash, and sensitive metadata', () => {
      const sensitive = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: '$2b$10$xyz',
        otpHash: 'secret_otp',
        twoFactorSecret: 'totp_secret',
        role: 'CLIENT',
      };

      const sanitized = sanitizeUser(sensitive);
      expect(sanitized.id).toBe('user-1');
      expect(sanitized.email).toBe('user@example.com');
      expect((sanitized as any).passwordHash).toBeUndefined();
      expect((sanitized as any).otpHash).toBeUndefined();
      expect((sanitized as any).twoFactorSecret).toBeUndefined();
    });
  });

  describe('resolveUserId', () => {
    it('should return userId from req.user.id', async () => {
      const req = { user: { id: 'usr-123' } };
      const userId = await service.resolveUserId(req);
      expect(userId).toBe('usr-123');
    });

    it('should return userId from req.session.userId', async () => {
      const req = { session: { userId: 'usr-456' } };
      const userId = await service.resolveUserId(req);
      expect(userId).toBe('usr-456');
    });

    it('should throw UnauthorizedException if no valid auth context is found', async () => {
      const req = { headers: {} };
      await expect(service.resolveUserId(req)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('createUser', () => {
    it('should call prisma.user.create and return sanitized result', async () => {
      mockPrisma.user.create.mockResolvedValue({
        id: 'usr-new',
        email: 'new@tebeka.et',
        name: 'New User',
        role: 'CLIENT',
        passwordHash: 'secret',
      });

      const result = await service.createUser({
        email: 'new@tebeka.et',
        name: 'New User',
      });

      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(result.id).toBe('usr-new');
      expect((result as any).passwordHash).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should return sanitized user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'usr-1',
        email: 'test@tebeka.et',
        passwordHash: 'hash',
      });

      const user = await service.findOne('usr-1');
      expect(user.id).toBe('usr-1');
      expect((user as any).passwordHash).toBeUndefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
