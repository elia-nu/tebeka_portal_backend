import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { PrismaService } from '../../database/prisma.service';
import { ConversationStatus, ConversationType } from '@prisma/client/communication';

describe('ConversationService (FR-COMM Unit Tests)', () => {
  let service: ConversationService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      conversation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'conv-1',
            bookingId: 'bk-101',
            type: ConversationType.DIRECT,
            status: ConversationStatus.ACTIVE,
            participants: [{ userId: 'usr-client' }, { userId: 'usr-attorney' }],
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'conv-new',
          ...data,
        })),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'out-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
  });

  it('TC-COMM-01: Should create a context-scoped thread for a confirmed booking', async () => {
    const res = await service.createConversation({
      bookingId: 'bk-101',
      participantIds: ['usr-attorney'],
      title: 'Consultation: Dawit Solomon',
    }, 'usr-client');

    expect(res).toBeDefined();
    expect(res.id).toBe('conv-new');
    expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'bk-101',
          createdById: 'usr-client',
        }),
      })
    );
  });

  it('TC-COMM-01 (Duplicate Guard): Should return existing thread if already created for the booking context', async () => {
    mockPrisma.conversation.findFirst.mockResolvedValueOnce({
      id: 'conv-existing',
      bookingId: 'bk-101',
      status: ConversationStatus.ACTIVE,
    });

    const res = await service.createConversation({
      bookingId: 'bk-101',
      participantIds: ['usr-attorney'],
    }, 'usr-client');

    expect(res.id).toBe('conv-existing');
    expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
  });

  it('Should reject conversation creation if fewer than 2 participants exist for non-system chats', async () => {
    await expect(service.createConversation({
      participantIds: [],
    }, 'usr-client')).rejects.toThrow(BadRequestException);
  });
});
