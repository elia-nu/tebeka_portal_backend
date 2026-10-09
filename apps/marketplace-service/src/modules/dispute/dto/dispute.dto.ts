import * as Joi from 'joi';
import { Priority, DisputeStatus } from '@prisma/client/marketplace';

export interface CreateDisputeDto {
  reason: string;
  details?: string;
  evidenceUrls?: string[];
  priority?: Priority;
}

export const CreateDisputeSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(500).required().messages({
    'string.empty': 'Dispute reason is required',
    'any.required': 'Dispute reason is required',
  }),
  details: Joi.string().trim().max(3000).optional(),
  evidenceUrls: Joi.array().items(Joi.string().uri()).optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('HIGH'),
});

export interface QueryDisputeDto {
  page?: number;
  limit?: number;
  status?: DisputeStatus;
  targetType?: 'CASE' | 'BOOKING' | 'ALL';
  priority?: Priority;
  caseId?: string;
  bookingId?: string;
  openedBy?: string;
  search?: string;
  sortBy?: 'createdAt' | 'priority' | 'slaDeadline' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export const QueryDisputeSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED').optional(),
  targetType: Joi.string().valid('CASE', 'BOOKING', 'ALL').default('ALL'),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional(),
  caseId: Joi.string().optional(),
  bookingId: Joi.string().optional(),
  openedBy: Joi.string().optional(),
  search: Joi.string().trim().optional(),
  sortBy: Joi.string().valid('createdAt', 'priority', 'slaDeadline', 'status').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export interface ResolveDisputeDto {
  resolutionOutcome: string;
  resolutionNotes: string;
  status?: DisputeStatus;
  caseStatusAction?: 'CLOSED' | 'RESOLVED' | 'IN_PROGRESS';
  bookingStatusAction?: 'COMPLETED' | 'CANCELLED' | 'CONFIRMED';
}

export const ResolveDisputeSchema = Joi.object({
  resolutionOutcome: Joi.string().trim().min(3).max(255).required().messages({
    'string.empty': 'Resolution outcome is required',
    'any.required': 'Resolution outcome is required',
  }),
  resolutionNotes: Joi.string().trim().min(5).max(3000).required().messages({
    'string.empty': 'Resolution notes/justification are required',
    'any.required': 'Resolution notes/justification are required',
  }),
  status: Joi.string().valid('RESOLVED', 'DISMISSED').default('RESOLVED'),
  caseStatusAction: Joi.string().valid('CLOSED', 'RESOLVED', 'IN_PROGRESS').optional(),
  bookingStatusAction: Joi.string().valid('COMPLETED', 'CANCELLED', 'CONFIRMED').optional(),
});
