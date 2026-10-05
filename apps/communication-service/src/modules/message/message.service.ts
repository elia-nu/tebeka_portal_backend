import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { MessageStatus, MessageType, ConversationStatus } from '@prisma/client/communication';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) {}
  async sendMessage(conversationId: string, data: any, senderId: string) {
    const conversation = await this.prisma.conversation.findUnique({
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

    return this.prisma.$transaction(async (tx) => {
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
    const isParticipant = await this.prisma.conversationParticipant.findUnique({
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
      this.prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
        include: { attachments: true, reads: true },
      }),
      this.prisma.message.count({ where }),
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
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages.');
    }

    // Enforce 15-minute policy window for edits
    const fifteenMinsMs = 15 * 60 * 1000;
    if (Date.now() - message.sentAt.getTime() > fifteenMinsMs) {
      throw new BadRequestException('Messages cannot be edited after 15 minutes of sending.');
    }

    return this.prisma.message.update({
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
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    if (mode === 'DELETE_FOR_EVERYONE') {
      if (message.senderId !== userId) {
        throw new ForbiddenException('You can only delete your own messages for everyone.');
      }
      return this.prisma.message.update({
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
        return this.prisma.message.update({
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
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    return this.prisma.$transaction(async (tx) => {
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
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });

    if (!participant) throw new NotFoundException(`Participant record not found`);

    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: {
        lastReadAt: new Date(),
      },
    });
  }

  // Unified Chat Moderation & Reporting (SCR-ADMIN-04 / FR-ADMIN-03 / FR-COMM)
  async reportMessage(messageId: string, data: any, reporterId: string) {
    if (!data.reason || !data.reason.trim()) {
      throw new BadRequestException('Report reason is required');
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.messageReport.create({
        data: {
          messageId,
          reporterId,
          category: data.category || 'OTHER',
          reason: data.reason.trim(),
          status: 'PENDING',
        },
        include: {
          message: true,
        },
      });

      await tx.message.update({
        where: { id: messageId },
        data: {
          reportCategory: data.category || 'OTHER',
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'MessageReport',
          aggregateId: report.id,
          eventType: 'MESSAGE_REPORTED',
          payload: {
            reportId: report.id,
            messageId,
            conversationId: message.conversationId,
            senderId: message.senderId,
            reporterId,
            category: data.category || 'OTHER',
            reason: data.reason,
          },
        },
      });

      return {
        success: true,
        message: 'Message reported to admin moderation queue for review.',
        report,
      };
    });
  }

  async getMessageReports(query: any = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.messageId) where.messageId = query.messageId;
    if (query.reporterId) where.reporterId = query.reporterId;

    const allowedSortFields = ['createdAt', 'status'];
    const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.messageReport.findMany({
        where,
        skip,
        take: limit,
        include: {
          message: {
            include: {
              attachments: true,
              conversation: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  bookingId: true,
                  caseId: true,
                },
              },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.messageReport.count({ where }),
    ]);

    // 1 business day SLA tracking per SRS FR-ADMIN-03
    const now = Date.now();
    const formattedItems = items.map((item) => {
      const createdAtMs = new Date(item.createdAt).getTime();
      const slaDeadline = new Date(createdAtMs + 24 * 60 * 60 * 1000);
      const isBreached = item.status === 'PENDING' && now > slaDeadline.getTime();
      const remainingMs = Math.max(0, slaDeadline.getTime() - now);

      return {
        ...item,
        sla: {
          targetBusinessDays: 1,
          slaDeadline,
          isBreached,
          remainingHours: item.status === 'PENDING' ? Math.round(remainingMs / (1000 * 60 * 60)) : 0,
        },
      };
    });

    const [pendingCount, actionedCount, dismissedCount] = await Promise.all([
      this.prisma.messageReport.count({ where: { status: 'PENDING' } }),
      this.prisma.messageReport.count({ where: { status: 'ACTIONED' } }),
      this.prisma.messageReport.count({ where: { status: 'DISMISSED' } }),
    ]);

    return {
      items: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        pendingCount,
        actionedCount,
        dismissedCount,
        totalActive: pendingCount,
      },
    };
  }

  async moderateMessage(reportId: string, data: any, adminId: string) {
    if (!data.actionTaken) {
      throw new BadRequestException('actionTaken is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.messageReport.findUnique({
        where: { id: reportId },
        include: { message: true },
      });

      if (!report) {
        throw new NotFoundException(`Message report ${reportId} not found`);
      }

      const updatedReport = await tx.messageReport.update({
        where: { id: reportId },
        data: {
          status: data.status || 'ACTIONED',
          actionTaken: data.actionTaken,
          adminNotes: data.adminNotes || null,
          resolvedBy: adminId,
          resolvedAt: new Date(),
        },
      });

      // If action is to delete or hide message
      if (data.actionTaken === 'DELETE_MESSAGE' && report.messageId) {
        await tx.message.update({
          where: { id: report.messageId },
          data: {
            deletedAt: new Date(),
            status: MessageStatus.DELETED,
          },
        });
      }

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'MessageReport',
          aggregateId: reportId,
          eventType: 'MESSAGE_MODERATED',
          payload: {
            reportId,
            messageId: report.messageId,
            actionTaken: data.actionTaken,
            adminNotes: data.adminNotes,
            adminId,
            status: data.status || 'ACTIONED',
          },
        },
      });

      return {
        success: true,
        message: `Message report ${reportId} moderated with action: ${data.actionTaken}`,
        report: updatedReport,
      };
    });
  }
}
