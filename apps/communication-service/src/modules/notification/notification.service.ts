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

  async getUserPreferences(userId: string) {
    let pref = await prisma.userNotificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      pref = await prisma.userNotificationPreference.create({
        data: {
          userId,
          emailEnabled: true,
          smsEnabled: true,
          pushEnabled: true,
          inAppEnabled: true,
          bookingUpdates: true,
          bookingReminders: true,
          caseUpdates: true,
          paymentAlerts: true,
          marketingPromotions: false,
          preferredLocale: 'en',
        },
      });
    }

    return {
      status: 'success',
      preferences: pref,
      channels: {
        email: pref.emailEnabled,
        sms: pref.smsEnabled,
        push: pref.pushEnabled,
        in_app: pref.inAppEnabled,
      },
      categories: {
        bookingUpdates: pref.bookingUpdates,
        bookingReminders: pref.bookingReminders,
        caseUpdates: pref.caseUpdates,
        paymentAlerts: pref.paymentAlerts,
        marketingPromotions: pref.marketingPromotions,
      },
    };
  }

  async updateUserPreferences(userId: string, data: any) {
    const pref = await prisma.userNotificationPreference.upsert({
      where: { userId },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        userId,
        ...data,
      },
    });

    return {
      status: 'success',
      message: 'Notification preferences updated successfully',
      preferences: pref,
      channels: {
        email: pref.emailEnabled,
        sms: pref.smsEnabled,
        push: pref.pushEnabled,
        in_app: pref.inAppEnabled,
      },
    };
  }

  async updateChannelPreferences(userId: string, channels: { email?: boolean; sms?: boolean; push?: boolean; in_app?: boolean }) {
    const updateData: any = {};
    if (channels.email !== undefined) updateData.emailEnabled = channels.email;
    if (channels.sms !== undefined) updateData.smsEnabled = channels.sms;
    if (channels.push !== undefined) updateData.pushEnabled = channels.push;
    if (channels.in_app !== undefined) updateData.inAppEnabled = channels.in_app;

    return this.updateUserPreferences(userId, updateData);
  }
}

