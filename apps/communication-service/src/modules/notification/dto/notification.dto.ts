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
