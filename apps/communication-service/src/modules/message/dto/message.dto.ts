import * as Joi from 'joi';
import { MessageType, ReportStatus } from '@prisma/client/communication';

export interface SendMessageDto {
  content: string;
  messageType?: MessageType;
  replyToId?: string;
  attachments?: Array<{
    fileName: string;
    fileKey: string;
    mimeType: string;
    sizeBytes: number;
    thumbnailKey?: string;
  }>;
  metadata?: any;
}

export const SendMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(5000).required(),
  messageType: Joi.string().valid('TEXT', 'FILE', 'IMAGE', 'SYSTEM', 'BOOKING_UPDATE', 'CASE_UPDATE', 'PAYMENT_UPDATE').default('TEXT'),
  replyToId: Joi.string().optional(),
  attachments: Joi.array().items(
    Joi.object({
      fileName: Joi.string().required(),
      fileKey: Joi.string().required(),
      mimeType: Joi.string().required(),
      sizeBytes: Joi.number().integer().min(1).required(),
      thumbnailKey: Joi.string().optional(),
    })
  ).optional(),
  metadata: Joi.object().optional(),
});

export interface EditMessageDto {
  content: string;
}

export const EditMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(5000).required(),
});

export interface DeleteMessageDto {
  mode: 'DELETE_FOR_ME' | 'DELETE_FOR_EVERYONE';
}

export const DeleteMessageSchema = Joi.object({
  mode: Joi.string().valid('DELETE_FOR_ME', 'DELETE_FOR_EVERYONE').default('DELETE_FOR_ME'),
});

export interface QueryMessageDto {
  page?: number;
  limit?: number;
  q?: string;
  beforeDate?: string;
}

export const QueryMessageSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  q: Joi.string().trim().allow('').optional(),
  beforeDate: Joi.date().iso().optional(),
});

export interface ReportMessageDto {
  reason: string;
  category?: string;
  details?: string;
}

export const ReportMessageSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(1000).required().messages({
    'string.empty': 'Report reason is required',
    'any.required': 'Report reason is required',
  }),
  category: Joi.string().valid('OFF_PLATFORM_SOLICITATION', 'HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'OTHER').default('OTHER'),
  details: Joi.string().trim().max(2000).optional(),
});

export interface QueryMessageReportDto {
  page?: number;
  limit?: number;
  status?: ReportStatus;
  category?: string;
  messageId?: string;
  reporterId?: string;
  sortBy?: 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export const QueryMessageReportSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED').optional(),
  category: Joi.string().optional(),
  messageId: Joi.string().optional(),
  reporterId: Joi.string().optional(),
  sortBy: Joi.string().valid('createdAt', 'status').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export interface ModerateMessageDto {
  actionTaken: 'DELETE_MESSAGE' | 'WARN_USER' | 'DISMISS' | 'SUSPEND_USER' | string;
  status?: ReportStatus;
  adminNotes?: string;
}

export const ModerateMessageSchema = Joi.object({
  actionTaken: Joi.string().valid('DELETE_MESSAGE', 'WARN_USER', 'DISMISS', 'SUSPEND_USER').required(),
  status: Joi.string().valid('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED').default('ACTIONED'),
  adminNotes: Joi.string().trim().max(1000).optional(),
});
