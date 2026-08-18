import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaClient, ConversationStatus, ConversationType, ParticipantRole } from '@prisma/client/communication';

const prisma = new PrismaClient();

@Injectable()
export class ConversationService {
  async createConversation(data: any, createdById: string) {
    const allParticipantIds = Array.from(new Set([createdById, ...(data.participantIds || [])]));

    if (allParticipantIds.length < 2 && data.type !== ConversationType.SYSTEM) {
      throw new BadRequestException('A conversation must have at least 2 participants.');
    }

    // Check if an existing direct or booking/case conversation already matches
    if (data.bookingId) {
      const existing = await prisma.conversation.findFirst({
        where: { bookingId: data.bookingId },
        include: { participants: true },
      });
      if (existing) return existing;
    }

    if (data.caseId) {
      const existing = await prisma.conversation.findFirst({
        where: { caseId: data.caseId },
        include: { participants: true },
      });
      if (existing) return existing;
    }

    // Create conversation & participants inside an interactive transaction
    return prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          title: data.title || null,
          type: data.type || ConversationType.DIRECT,
          status: ConversationStatus.ACTIVE,
          bookingId: data.bookingId || null,
          caseId: data.caseId || null,
          createdById,
          participants: {
            create: allParticipantIds.map((userId) => ({
              userId,
              role: userId === createdById ? (data.role || ParticipantRole.CLIENT) : ParticipantRole.ATTORNEY,
            })),
          },
        },
        include: { participants: true },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Conversation',
          aggregateId: conversation.id,
          eventType: 'CONVERSATION_CREATED',
          payload: {
            conversationId: conversation.id,
            bookingId: data.bookingId,
            caseId: data.caseId,
            participants: allParticipantIds,
          },
        },
      });

      return conversation;
    });
  }

  async getUserConversations(userId: string, query: any = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {
      participants: {
        some: {
          userId,
          ...(query.status === 'ARCHIVED' ? { isArchived: true } : { isArchived: false }),
        },
      },
    };

    if (query.type) where.type = query.type;
    if (query.status && query.status !== 'ARCHIVED') where.status = query.status;
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.caseId) where.caseId = query.caseId;

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { lastMessageText: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          participants: true,
          messages: {
            take: 1,
            orderBy: { sentAt: 'desc' },
            include: { attachments: true },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    // Enhance each conversation with unread count for requesting user
    const items = await Promise.all(
      conversations.map(async (conv) => {
        const participant = conv.participants.find((p) => p.userId === userId);
        const lastReadAt = participant?.lastReadAt || new Date(0);

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            sentAt: { gt: lastReadAt },
            deletedAt: null,
          },
        });

        return {
          ...conv,
          unreadCount,
          isMuted: participant?.isMuted || false,
          isArchived: participant?.isArchived || false,
        };
      })
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getConversationDetails(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
        messages: {
          take: 50,
          orderBy: { sentAt: 'asc' },
          include: { attachments: true, reads: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    const isMember = conversation.participants.some((p) => p.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You do not have access to this conversation.');
    }

    return conversation;
  }

  async archiveConversation(conversationId: string, userId: string) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!participant) {
      throw new NotFoundException(`Conversation participant record not found`);
    }

    return prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isArchived: true },
    });
  }

  async closeConversation(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conversation) throw new NotFoundException(`Conversation ${conversationId} not found`);

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.CLOSED },
    });
  }

  async blockConversation(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) throw new NotFoundException(`Conversation ${conversationId} not found`);

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.BLOCKED },
    });
  }

  async getOrCreateBookingConversation(bookingId: string, clientId: string, attorneyId: string, title?: string) {
    const existing = await prisma.conversation.findFirst({
      where: { bookingId },
      include: {
        participants: true,
        messages: { take: 20, orderBy: { sentAt: 'desc' }, include: { attachments: true } },
      },
    });

    if (existing) return existing;

    return this.createConversation(
      {
        title: title || `Consultation Chat - ${bookingId}`,
        type: ConversationType.BOOKING_CONSULTATION,
        bookingId,
        participantIds: [clientId, attorneyId],
        role: ParticipantRole.CLIENT,
      },
      clientId
    );
  }

  async getOrCreateCaseConversation(caseId: string, clientId: string, attorneyId: string, title?: string) {
    const existing = await prisma.conversation.findFirst({
      where: { caseId },
      include: {
        participants: true,
        messages: { take: 20, orderBy: { sentAt: 'desc' }, include: { attachments: true } },
      },
    });

    if (existing) return existing;

    return this.createConversation(
      {
        title: title || `Case Discussion - ${caseId}`,
        type: ConversationType.CASE_DISCUSSION,
        caseId,
        participantIds: [clientId, attorneyId],
        role: ParticipantRole.CLIENT,
      },
      clientId
    );
  }
}
