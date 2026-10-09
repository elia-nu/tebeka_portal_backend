import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MessageStatus } from '@prisma/client/communication';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class MessageModerationService {
  constructor(private readonly prisma: PrismaService) {}

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
