import * as Joi from 'joi';
import { CaseStatus, Priority } from '@prisma/client/marketplace';

export interface CreateCaseDto {
  title: string;
  description: string;
  attorneyId: string;
  clientId?: string;
  bookingId?: string;
  practiceAreaId?: string;
  priority?: Priority;
  opposingPartyName?: string;
  involvedOrganization?: string;
  conflictAcknowledged?: boolean;
  timeSensitiveDate?: string;
  urgencyReason?: string;
}

export const CreateCaseSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required(),
  description: Joi.string().trim().min(10).required(),
  attorneyId: Joi.string().uuid().required(),
  clientId: Joi.string().uuid().optional(),
  bookingId: Joi.string().uuid().optional(),
  practiceAreaId: Joi.string().uuid().optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('MEDIUM'),
  opposingPartyName: Joi.string().trim().allow('').optional(),
  involvedOrganization: Joi.string().trim().allow('').optional(),
  conflictAcknowledged: Joi.boolean().default(false),
  timeSensitiveDate: Joi.date().iso().allow(null).optional(),
  urgencyReason: Joi.string().trim().allow('').optional(),
});

export interface UpdateCaseStatusDto {
  status: CaseStatus;
}

export const UpdateCaseStatusSchema = Joi.object({
  status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'PENDING_REVIEW', 'CLOSED', 'ARCHIVED').required(),
});

export interface QueryCaseDto {
  page?: number;
  limit?: number;
  userId?: string;
  role?: string;
  clientId?: string;
  attorneyId?: string;
  practiceAreaId?: string;
  status?: CaseStatus;
  priority?: Priority;
  q?: string;
  search?: string;
  fromOpenedAt?: string;
  toOpenedAt?: string;
  sortBy?: 'openedAt' | 'closedAt' | 'priority' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export const QueryCaseSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  userId: Joi.string().uuid().optional(),
  role: Joi.string().valid('CLIENT', 'ATTORNEY', 'ADMIN', 'SUPER_ADMIN').optional(),
  clientId: Joi.string().uuid().optional(),
  attorneyId: Joi.string().uuid().optional(),
  practiceAreaId: Joi.string().uuid().optional(),
  status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'PENDING_REVIEW', 'CLOSED', 'ARCHIVED').optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional(),
  q: Joi.string().trim().allow('').optional(),
  search: Joi.string().trim().allow('').optional(),
  fromOpenedAt: Joi.date().iso().optional(),
  toOpenedAt: Joi.date().iso().optional(),
  sortBy: Joi.string().valid('openedAt', 'closedAt', 'priority', 'title').default('openedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});
