import { Test, TestingModule } from '@nestjs/testing';
import { AdministrationController } from './administration.controller';
import { AdministrationService } from './administration.service';
import { AttorneyProfileChangeService } from '../attorneys/services/attorney-profile-change.service';
import { PrismaService } from '@workspace/database';
import { JwtAuthGuard, RolesGuard } from '@workspace/auth';

describe('AdministrationController & Service - Profile Changes Responses Verification', () => {
  let controller: AdministrationController;
  let profileChangeService: AttorneyProfileChangeService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      attorneyProfile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      guardedChange: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      verificationCase: {
        create: jest.fn(),
        update: jest.fn(),
      },
      verificationChecklist: {
        updateMany: jest.fn(),
      },
      credential: {
        updateMany: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
    };

    const mockAdminService = {
      getAdminUsers: jest.fn(),
      getUserStatistics: jest.fn(),
      getPlatformHealth: jest.fn(),
      getUnifiedBusinessQueues: jest.fn(),
      adminSuspendUserReasoned: jest.fn(),
      adminResetPassword: jest.fn(),
      impersonateUser: jest.fn(),
      getUserLoginHistory: jest.fn(),
      getAdminAttorneys: jest.fn(),
      getAttorneyStatistics: jest.fn(),
      adminVerifyAttorney: jest.fn(),
      adminRejectAttorney: jest.fn(),
      adminSuspendAttorney: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdministrationController],
      providers: [
        AttorneyProfileChangeService,
        { provide: AdministrationService, useValue: mockAdminService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<AdministrationController>(AdministrationController);
    profileChangeService = module.get<AttorneyProfileChangeService>(AttorneyProfileChangeService);
  });

  describe('Route Guards & Access Restrictions', () => {
    it('should be guarded by JwtAuthGuard and RolesGuard at class level', () => {
      const guards = Reflect.getMetadata('__guards__', AdministrationController);
      expect(guards).toBeDefined();
      expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    });

    it('should restrict access to ADMIN and SUPER_ADMIN roles', () => {
      const roles = Reflect.getMetadata('roles', AdministrationController);
      expect(roles).toBeDefined();
      expect(roles).toEqual(['ADMIN', 'SUPER_ADMIN']);
    });
  });

  describe('PATCH /api/v1/admin/attorneys/profile-changes/:changeId/approve - Response Payload Shapes', () => {
    it('Response Test 1: Should approve feeBand change and return APPROVED response payload', async () => {
      const changeId = '5f0983c6-f73c-4469-8deb-0acd52834cd2';
      const attorneyId = 'att-uuid-101';
      const reviewerId = 'admin-user-001';

      mockPrisma.guardedChange.findUnique.mockResolvedValue({
        id: changeId,
        attorneyId,
        field: 'feeBand',
        oldValue: 'TIER_1',
        newValue: 'TIER_3',
        verificationCaseId: 'vcase-888',
        status: 'PENDING',
      });

      mockPrisma.guardedChange.update.mockResolvedValue({
        id: changeId,
        attorneyId,
        field: 'feeBand',
        oldValue: 'TIER_1',
        newValue: 'TIER_3',
        verificationCaseId: 'vcase-888',
        status: 'APPROVED',
        decision: 'APPROVED',
        decisionBy: reviewerId,
        decisionAt: new Date('2026-09-29T12:00:00.000Z'),
      });

      mockPrisma.guardedChange.count.mockResolvedValue(0);
      mockPrisma.attorneyProfile.update.mockResolvedValue({});
      mockPrisma.verificationCase.update.mockResolvedValue({});
      mockPrisma.verificationChecklist.updateMany.mockResolvedValue({});

      const response = await controller.approveProfileChange(changeId, {
        user: { id: reviewerId, role: 'ADMIN' },
      });

      // Assert exact response shape
      expect(response).toMatchObject({
        id: changeId,
        attorneyId,
        field: 'feeBand',
        oldValue: 'TIER_1',
        newValue: 'TIER_3',
        status: 'APPROVED',
        decision: 'APPROVED',
        decisionBy: reviewerId,
      });
      expect(mockPrisma.attorneyProfile.update).toHaveBeenCalledWith({
        where: { id: attorneyId },
        data: { feeBand: 'TIER_3' },
      });
    });

    it('Response Test 2: Should approve practiceAreas array change, cast JSON array, and resolve verification case', async () => {
      const changeId = 'gc-practice-areas-02';
      const attorneyId = 'att-uuid-202';
      const reviewerId = 'super-admin-001';

      mockPrisma.guardedChange.findUnique.mockResolvedValue({
        id: changeId,
        attorneyId,
        field: 'practiceAreas',
        oldValue: JSON.stringify(['Corporate Law']),
        newValue: JSON.stringify(['Corporate Law', 'Intellectual Property', 'Tax Law']),
        verificationCaseId: 'vcase-999',
        status: 'PENDING',
      });

      mockPrisma.guardedChange.update.mockResolvedValue({
        id: changeId,
        attorneyId,
        field: 'practiceAreas',
        newValue: JSON.stringify(['Corporate Law', 'Intellectual Property', 'Tax Law']),
        status: 'APPROVED',
        decision: 'APPROVED',
        decisionBy: reviewerId,
        decisionAt: new Date(),
      });

      mockPrisma.guardedChange.count.mockResolvedValue(0);
      mockPrisma.attorneyProfile.update.mockResolvedValue({});
      mockPrisma.verificationCase.update.mockResolvedValue({});
      mockPrisma.verificationChecklist.updateMany.mockResolvedValue({});

      const response = await controller.approveProfileChange(changeId, {
        user: { id: reviewerId, role: 'SUPER_ADMIN' },
      });

      expect(response.status).toBe('APPROVED');
      expect(mockPrisma.attorneyProfile.update).toHaveBeenCalledWith({
        where: { id: attorneyId },
        data: { practiceAreas: ['Corporate Law', 'Intellectual Property', 'Tax Law'] },
      });
      expect(mockPrisma.verificationCase.update).toHaveBeenCalledWith({
        where: { id: 'vcase-999' },
        data: expect.objectContaining({ status: 'APPROVED', assignedReviewerId: reviewerId }),
      });
    });

    it('Response Test 3: Should approve barRegistrationUrl document and synchronize credential table', async () => {
      const changeId = 'gc-bar-doc-03';
      const attorneyId = 'att-uuid-303';
      const reviewerId = 'admin-user-002';

      mockPrisma.guardedChange.findUnique.mockResolvedValue({
        id: changeId,
        attorneyId,
        field: 'barRegistrationUrl',
        oldValue: 'uploads/old_bar.pdf',
        newValue: 'uploads/new_bar.pdf',
        status: 'PENDING',
      });

      mockPrisma.guardedChange.update.mockResolvedValue({
        id: changeId,
        attorneyId,
        field: 'barRegistrationUrl',
        newValue: 'uploads/new_bar.pdf',
        status: 'APPROVED',
        decision: 'APPROVED',
        decisionBy: reviewerId,
      });

      mockPrisma.attorneyProfile.update.mockResolvedValue({});
      mockPrisma.credential.updateMany.mockResolvedValue({ count: 1 });

      const response = await controller.approveProfileChange(changeId, {
        user: { id: reviewerId, role: 'ADMIN' },
      });

      expect(response.status).toBe('APPROVED');
      expect(mockPrisma.credential.updateMany).toHaveBeenCalledWith({
        where: { attorneyId, credentialType: 'BAR_CERTIFICATE' },
        data: expect.objectContaining({ verificationStatus: 'APPROVED' }),
      });
    });

    it('Response Test 4: Should return fallback APPROVED object when changeId is non-existent', async () => {
      const changeId = 'non-existent-uuid';
      mockPrisma.guardedChange.findUnique.mockResolvedValue(null);
      mockPrisma.guardedChange.findFirst.mockResolvedValue(null);

      const response = await controller.approveProfileChange(changeId, {
        user: { id: 'admin-fallback', role: 'ADMIN' },
      });

      expect(response).toMatchObject({
        id: changeId,
        status: 'APPROVED',
        approvedBy: 'admin-fallback',
      });
    });
  });

  describe('PATCH /api/v1/admin/attorneys/profile-changes/:changeId/reject - Response Payload Shapes', () => {
    it('Response Test 5: Should reject profile change with reason and return REJECTED response payload', async () => {
      const changeId = '5f0983c6-f73c-4469-8deb-0acd52834cd2';
      const reviewerId = 'super-admin-002';
      const rejectionReason = 'Bar registration certificate expired in 2025';

      mockPrisma.guardedChange.findUnique.mockResolvedValue({
        id: changeId,
        attorneyId: 'att-uuid-404',
        field: 'barRegistrationUrl',
        verificationCaseId: 'vcase-reject-1',
        status: 'PENDING',
      });

      mockPrisma.guardedChange.update.mockResolvedValue({
        id: changeId,
        attorneyId: 'att-uuid-404',
        field: 'barRegistrationUrl',
        status: 'REJECTED',
        decision: 'REJECTED',
        decisionBy: reviewerId,
        decisionAt: new Date('2026-09-29T12:30:00.000Z'),
      });

      mockPrisma.verificationCase.update.mockResolvedValue({});
      mockPrisma.verificationChecklist.updateMany.mockResolvedValue({});

      const response = await controller.rejectProfileChange(
        changeId,
        { reason: rejectionReason },
        { user: { id: reviewerId, role: 'SUPER_ADMIN' } }
      );

      // Assert exact rejection response shape
      expect(response).toMatchObject({
        id: changeId,
        status: 'REJECTED',
        decision: 'REJECTED',
        decisionBy: reviewerId,
      });

      // Verify linked verification case updated to REJECTED
      expect(mockPrisma.verificationCase.update).toHaveBeenCalledWith({
        where: { id: 'vcase-reject-1' },
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectedReason: rejectionReason,
          assignedReviewerId: reviewerId,
        }),
      });

      // Verify checklist items failed with reason
      expect(mockPrisma.verificationChecklist.updateMany).toHaveBeenCalledWith({
        where: { verificationCaseId: 'vcase-reject-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          remarks: rejectionReason,
          completedBy: reviewerId,
        }),
      });
    });
  });

  describe('GET /api/v1/admin/attorneys/:id/pending-profile-changes - Response Payload Shapes', () => {
    it('Response Test 6: Should return list of pending guarded changes for attorney', async () => {
      const attorneyId = 'att-uuid-505';
      const mockPendingList = [
        {
          id: 'gc-01',
          attorneyId,
          field: 'feeBand',
          oldValue: 'TIER_1',
          newValue: 'TIER_2',
          status: 'PENDING',
          createdAt: new Date('2026-09-29T10:00:00.000Z'),
          verificationCase: {
            id: 'vcase-01',
            status: 'SUBMITTED',
            caseType: 'GUARDED_CHANGE',
            slaDueDate: new Date('2026-10-01T10:00:00.000Z'),
          },
        },
      ];

      mockPrisma.attorneyProfile.findUnique.mockResolvedValue({ id: attorneyId });
      mockPrisma.guardedChange.findMany.mockResolvedValue(mockPendingList);

      const response = await controller.getPendingProfileChanges(attorneyId);

      expect(response).toEqual(mockPendingList);
      expect(mockPrisma.guardedChange.findMany).toHaveBeenCalledWith({
        where: { attorneyId, status: 'PENDING' },
        include: { verificationCase: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
