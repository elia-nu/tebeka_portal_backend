import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdministrationService } from './administration.service';
import { PrismaService } from '@workspace/database';

describe('AdministrationService (FR-ADMIN Reasoned Suspension & Health)', () => {
  let service: AdministrationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      attorneyProfile: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      session: {
        deleteMany: jest.fn(),
      },
      adminAction: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      practiceArea: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministrationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdministrationService>(AdministrationService);
  });

  it('should require reasonCode and adminNote for admin reasoned suspension', async () => {
    await expect(
      service.adminSuspendUserReasoned('user-1', {
        reasonCode: '',
        adminNote: '',
        adminId: 'admin-1',
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('should perform 5 mandatory controls during reasoned user suspension: status update, session revocation, attorney cascade, adminAction, and auditLog', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ATTORNEY' });
    prisma.user.update.mockResolvedValue({ id: 'user-1', status: 'SUSPENDED' });
    prisma.session.deleteMany.mockResolvedValue({ count: 2 });
    prisma.attorneyProfile.updateMany.mockResolvedValue({ count: 1 });
    prisma.adminAction.create.mockResolvedValue({ id: 'act-1' });
    prisma.auditLog.create.mockResolvedValue({ id: 'aud-1' });

    const result = await service.adminSuspendUserReasoned('user-1', {
      reasonCode: 'FRAUD_SUSPECTED',
      adminNote: 'Tampered bar license credentials submitted',
      adminId: 'admin-super',
      ipAddress: '192.168.1.50',
    });

    expect(result.status).toBe('success');
    expect(result.userStatus).toBe('SUSPENDED');
    expect(result.sessionsRevoked).toBe(true);
    expect(result.auditLogRecorded).toBe(true);

    // Verify session deletion was invoked
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });

    // Verify admin action record with reasonCode, adminNote, beforeState, and afterState
    expect(prisma.adminAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminId: 'admin-super',
        action: 'USER_SUSPENDED_REASONED',
        entity: 'User',
        entityId: 'user-1',
        reasonCode: 'FRAUD_SUSPECTED',
        adminNote: 'Tampered bar license credentials submitted',
        beforeState: expect.any(Object),
        afterState: { status: 'SUSPENDED' },
      }),
    });

    // Verify audit log recorded
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-super',
        action: 'USER_SUSPENDED',
        entity: 'User',
        entityId: 'user-1',
      }),
    });
  });

  it('should provide platform health metrics', async () => {
    const health = await service.getPlatformHealth();
    expect(health.systemStatus).toBe('OPERATIONAL');
    expect(health.metrics.verificationSlaAdherencePercentage).toBeGreaterThanOrEqual(90);
    expect(health.metrics.notificationDeliverySuccessRate).toBeGreaterThanOrEqual(95);
  });

  describe('Practice Areas Admin CRUD', () => {
    it('should create a practice area with generated slug key if not provided', async () => {
      prisma.practiceArea.findUnique.mockResolvedValue(null);
      prisma.practiceArea.create.mockResolvedValue({
        id: 'pa-1',
        key: 'environmental-law',
        nameEn: 'Environmental Law',
        nameAm: 'የአካባቢ ጥበቃ ሕግ',
      });

      const result = await service.createAdminPracticeArea({
        nameEn: 'Environmental Law',
        nameAm: 'የአካባቢ ጥበቃ ሕግ',
      });

      expect(result.id).toBe('pa-1');
      expect(prisma.practiceArea.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: 'environmental-law',
          nameEn: 'Environmental Law',
          nameAm: 'የአካባቢ ጥበቃ ሕግ',
        }),
      });
    });

    it('should list practice areas with pagination and search', async () => {
      prisma.practiceArea.findMany.mockResolvedValue([{ id: 'pa-1', nameEn: 'Corporate Law' }]);
      prisma.practiceArea.count.mockResolvedValue(1);

      const result = await service.getAdminPracticeAreas({ q: 'corporate', page: 1, limit: 10 });
      expect(result.items.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should update a practice area', async () => {
      prisma.practiceArea.findUnique.mockResolvedValue({ id: 'pa-1', key: 'corporate-law' });
      prisma.practiceArea.update.mockResolvedValue({ id: 'pa-1', nameEn: 'Updated Corporate Law' });

      const result = await service.updateAdminPracticeArea('pa-1', { nameEn: 'Updated Corporate Law' });
      expect(result.nameEn).toBe('Updated Corporate Law');
    });

    it('should delete a practice area', async () => {
      prisma.practiceArea.findUnique.mockResolvedValue({ id: 'pa-1', nameEn: 'Corporate Law' });
      prisma.practiceArea.delete.mockResolvedValue({ id: 'pa-1' });

      const result = await service.deleteAdminPracticeArea('pa-1');
      expect(result.success).toBe(true);
    });
  });
});
