import * as Joi from 'joi';
import { NotificationChannel, NotificationPriority } from '@prisma/client/communication';

export interface DispatchNotificationDto {
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  deviceToken?: string;
  templateKey?: string;
  title?: string;
  body?: string;
  category?: string;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  actionUrl?: string;
  referenceNumber?: string;
  variables?: Record<string, any>;
  locale?: string;
}

export const DispatchNotificationSchema = Joi.object({
  recipientId: Joi.string().uuid().required(),
  recipientEmail: Joi.string().email().optional(),
  recipientPhone: Joi.string().optional(),
  deviceToken: Joi.string().optional(),
  templateKey: Joi.string().optional(),
  title: Joi.string().optional(),
  body: Joi.string().optional(),
  category: Joi.string().default('SYSTEM'),
  priority: Joi.string().valid('LOW', 'NORMAL', 'HIGH', 'CRITICAL').default('NORMAL'),
  channels: Joi.array().items(Joi.string().valid('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WEBSOCKET')).optional(),
  actionUrl: Joi.string().optional(),
  referenceNumber: Joi.string().optional(),
  variables: Joi.object().optional(),
  locale: Joi.string().default('en'),
});

export interface QueryNotificationDto {
  page?: number;
  limit?: number;
  isRead?: boolean;
  category?: string;
}

export const QueryNotificationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  isRead: Joi.boolean().optional(),
  category: Joi.string().optional(),
});

export interface UpdateNotificationPreferenceDto {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  bookingUpdates?: boolean;
  bookingReminders?: boolean;
  caseUpdates?: boolean;
  paymentAlerts?: boolean;
  marketingPromotions?: boolean;
  preferredLocale?: string;
  customSettings?: Record<string, any>;
}

export const UpdateNotificationPreferenceSchema = Joi.object({
  emailEnabled: Joi.boolean().optional(),
  smsEnabled: Joi.boolean().optional(),
  pushEnabled: Joi.boolean().optional(),
  inAppEnabled: Joi.boolean().optional(),
  bookingUpdates: Joi.boolean().optional(),
  bookingReminders: Joi.boolean().optional(),
  caseUpdates: Joi.boolean().optional(),
  paymentAlerts: Joi.boolean().optional(),
  marketingPromotions: Joi.boolean().optional(),
  preferredLocale: Joi.string().valid('en', 'am').optional(),
  customSettings: Joi.object().optional(),
});

export interface UpdateChannelPreferencesDto {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  in_app?: boolean;
}

export const UpdateChannelPreferencesSchema = Joi.object({
  email: Joi.boolean().optional(),
  sms: Joi.boolean().optional(),
  push: Joi.boolean().optional(),
  in_app: Joi.boolean().optional(),
});
