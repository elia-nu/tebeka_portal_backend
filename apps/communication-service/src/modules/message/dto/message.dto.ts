import * as Joi from 'joi';
import { MessageType } from '@prisma/client/communication';

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
  replyToId: Joi.string().uuid().optional(),
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
