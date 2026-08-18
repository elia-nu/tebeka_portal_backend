import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, NotificationStatus } from '@prisma/client/communication';

const prisma = new PrismaClient();

@Injectable()
export class NotificationService {
  async getUserNotifications(userId: string, query: any = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = { recipientId: userId };

    if (query.isRead === true || query.isRead === 'true') {
      where.readAt = { not: null };
    } else if (query.isRead === false || query.isRead === 'false') {
      where.readAt = null;
    }

    if (query.category) {
      where.category = query.category;
    }

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { recipientId: userId, readAt: null } }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.recipientId !== userId) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: {
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.recipientId !== userId) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    return prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  async registerDeviceToken(userId: string, data: { token: string; platform?: string }) {
    return prisma.deviceToken.upsert({
      where: { token: data.token },
      update: {
        userId,
        platform: data.platform || 'ANDROID',
        isActive: true,
      },
      create: {
        userId,
        token: data.token,
        platform: data.platform || 'ANDROID',
        isActive: true,
      },
    });
  }

  async removeDeviceToken(userId: string, token: string) {
    return prisma.deviceToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });
  }

  async getUserDeviceTokens(userId: string) {
    return prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
