import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from './message.service';
import { PrismaService } from '../../database/prisma.service';
import { MessageStatus } from '@prisma/client/communication';

describe('MessageService (Chat Moderation & Reports)', () => {
  let service: MessageService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      message: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'msg-1', ...data })),
      },
      messageReport: {
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'mrep-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'mrep-1', ...data })),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'out-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
  });

  describe('Report Message (SCR-ADMIN-04 / FR-ADMIN-03)', () => {
    it('should report message, create MessageReport, and emit event', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-2',
        content: 'Contact me directly on WhatsApp at +251911...',
      });

      const res = await service.reportMessage(
        'msg-1',
        { reason: 'Off-platform solicitation', category: 'OFF_PLATFORM_SOLICITATION' },
        'user-1'
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.messageReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messageId: 'msg-1',
            reporterId: 'user-1',
            category: 'OFF_PLATFORM_SOLICITATION',
            reason: 'Off-platform solicitation',
            status: 'PENDING',
          }),
        })
      );
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'MESSAGE_REPORTED',
        }),
      });
    });
  });

  describe('Moderate Reported Message', () => {
    it('should take moderation action and delete message when action is DELETE_MESSAGE', async () => {
      mockPrisma.messageReport.findUnique.mockResolvedValue({
        id: 'mrep-1',
        messageId: 'msg-1',
        status: 'PENDING',
      });

      const res = await service.moderateMessage(
        'mrep-1',
        { actionTaken: 'DELETE_MESSAGE', adminNotes: 'Off-platform contact info removed.' },
        'admin-1'
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.messageReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mrep-1' },
          data: expect.objectContaining({
            actionTaken: 'DELETE_MESSAGE',
            resolvedBy: 'admin-1',
          }),
        })
      );
      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({
          status: MessageStatus.DELETED,
        }),
      });
    });
  });
});
