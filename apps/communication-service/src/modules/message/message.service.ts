import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaClient, MessageStatus, MessageType, ConversationStatus } from '@prisma/client/communication';

const prisma = new PrismaClient();

@Injectable()
export class MessageService {
  async sendMessage(conversationId: string, data: any, senderId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }

    if (conversation.status === ConversationStatus.CLOSED || conversation.status === ConversationStatus.BLOCKED) {
      throw new BadRequestException(`Cannot send messages in a ${conversation.status.toLowerCase()} conversation.`);
    }

    const isParticipant = conversation.participants.some((p) => p.userId === senderId);
    if (!isParticipant && data.messageType !== MessageType.SYSTEM) {
      throw new ForbiddenException('You are not a participant in this conversation.');
    }

    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId,
          senderId,
          messageType: data.messageType || MessageType.TEXT,
          content: data.content,
          status: MessageStatus.SENT,
          replyToId: data.replyToId || null,
          metadata: data.metadata || null,
          attachments: {
            create: (data.attachments || []).map((att: any) => ({
              fileName: att.fileName,
              fileKey: att.fileKey,
              mimeType: att.mimeType,
              sizeBytes: Number(att.sizeBytes),
              thumbnailKey: att.thumbnailKey || null,
            })),
          },
        },
        include: { attachments: true },
      });

      // Update conversation last message timestamp & preview text
      const previewText = data.content.length > 100 ? `${data.content.substring(0, 97)}...` : data.content;
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: message.sentAt,
          lastMessageText: previewText,
        },
      });

      // Automatically record read status for sender
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: senderId } },
        data: {
          lastReadAt: message.sentAt,
          lastReadMessageId: message.id,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Message',
          aggregateId: message.id,
          eventType: 'MESSAGE_SENT',
          payload: {
            messageId: message.id,
            conversationId,
            senderId,
            content: message.content,
            messageType: message.messageType,
            sentAt: message.sentAt,
          },
        },
      });

      return message;
    });
  }

  async getConversationMessages(conversationId: string, userId: string, query: any = {}) {
    const isParticipant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!isParticipant) {
      throw new ForbiddenException('You do not have access to messages in this conversation.');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 50);
    const skip = (page - 1) * limit;

    const where: any = {
      conversationId,
      deletedAt: null,
      NOT: {
        deletedForIds: { has: userId },
      },
    };

    if (query.q) {
      where.content = { contains: query.q, mode: 'insensitive' };
    }

    if (query.beforeDate) {
      where.sentAt = { lt: new Date(query.beforeDate) };
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
        include: { attachments: true, reads: true },
      }),
      prisma.message.count({ where }),
    ]);

    return {
      items: messages.reverse(),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async editMessage(messageId: string, data: { content: string }, userId: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages.');
    }

    // Enforce 15-minute policy window for edits
    const fifteenMinsMs = 15 * 60 * 1000;
    if (Date.now() - message.sentAt.getTime() > fifteenMinsMs) {
      throw new BadRequestException('Messages cannot be edited after 15 minutes of sending.');
    }

    return prisma.message.update({
      where: { id: messageId },
      data: {
        content: data.content,
        isEdited: true,
        editedAt: new Date(),
      },
      include: { attachments: true },
    });
  }

  async deleteMessage(messageId: string, mode: 'DELETE_FOR_ME' | 'DELETE_FOR_EVERYONE', userId: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    if (mode === 'DELETE_FOR_EVERYONE') {
      if (message.senderId !== userId) {
        throw new ForbiddenException('You can only delete your own messages for everyone.');
      }
      return prisma.message.update({
        where: { id: messageId },
        data: {
          deletedAt: new Date(),
          content: 'This message was deleted',
          status: MessageStatus.DELETED,
        },
      });
    } else {
      const existingIds = message.deletedForIds || [];
      if (!existingIds.includes(userId)) {
        return prisma.message.update({
          where: { id: messageId },
          data: {
            deletedForIds: { push: userId },
          },
        });
      }
      return message;
    }
  }

  async markMessageRead(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    return prisma.$transaction(async (tx) => {
      const readRecord = await tx.messageRead.upsert({
        where: { messageId_userId: { messageId, userId } },
        update: { readAt: new Date() },
        create: { messageId, userId },
      });

      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: message.conversationId, userId } },
        data: {
          lastReadAt: new Date(),
          lastReadMessageId: messageId,
        },
      });

      return readRecord;
    });
  }

  async markAllMessagesRead(conversationId: string, userId: string) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!participant) throw new NotFoundException(`Participant record not found`);

    return prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: {
        lastReadAt: new Date(),
      },
    });
  }
}
