import * as Joi from 'joi';
import { ConversationType, ConversationStatus, ParticipantRole } from '@prisma/client/communication';

export interface CreateConversationDto {
  title?: string;
  type?: ConversationType;
  bookingId?: string;
  caseId?: string;
  participantIds: string[];
  role?: ParticipantRole;
}

export const CreateConversationSchema = Joi.object({
  title: Joi.string().trim().max(150).optional(),
  type: Joi.string().valid('DIRECT', 'CASE_DISCUSSION', 'BOOKING_CONSULTATION', 'SUPPORT', 'SYSTEM').default('DIRECT'),
  bookingId: Joi.string().uuid().optional(),
  caseId: Joi.string().uuid().optional(),
  participantIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  role: Joi.string().valid('CLIENT', 'ATTORNEY', 'ADMIN', 'SUPPORT').optional(),
});

export interface UpdateConversationDto {
  title?: string;
  status?: ConversationStatus;
}

export const UpdateConversationSchema = Joi.object({
  title: Joi.string().trim().max(150).optional(),
  status: Joi.string().valid('ACTIVE', 'ARCHIVED', 'CLOSED', 'BLOCKED').optional(),
});

export interface QueryConversationDto {
  page?: number;
  limit?: number;
  type?: ConversationType;
  status?: ConversationStatus;
  bookingId?: string;
  caseId?: string;
  q?: string;
}

export const QueryConversationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  type: Joi.string().valid('DIRECT', 'CASE_DISCUSSION', 'BOOKING_CONSULTATION', 'SUPPORT', 'SYSTEM').optional(),
  status: Joi.string().valid('ACTIVE', 'ARCHIVED', 'CLOSED', 'BLOCKED').default('ACTIVE'),
  bookingId: Joi.string().uuid().optional(),
  caseId: Joi.string().uuid().optional(),
  q: Joi.string().trim().allow('').optional(),
});
