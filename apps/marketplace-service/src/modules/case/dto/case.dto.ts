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
  attorneyId: Joi.string().required(),
  clientId: Joi.string().optional(),
  bookingId: Joi.string().optional(),
  practiceAreaId: Joi.string().optional(),
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
  status: Joi.string()
    .valid('SUBMITTED', 'OPEN', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'DISPUTED', 'RESOLVED', 'CLOSED', 'ARCHIVED', 'CANCELLED')
    .required(),
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
  userId: Joi.string().optional(),
  role: Joi.string().valid('CLIENT', 'ATTORNEY', 'ADMIN', 'SUPER_ADMIN').optional(),
  clientId: Joi.string().optional(),
  attorneyId: Joi.string().optional(),
  practiceAreaId: Joi.string().optional(),
  status: Joi.string()
    .valid('SUBMITTED', 'OPEN', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'DISPUTED', 'RESOLVED', 'CLOSED', 'ARCHIVED', 'CANCELLED')
    .optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional(),
  q: Joi.string().trim().allow('').optional(),
  search: Joi.string().trim().allow('').optional(),
  fromOpenedAt: Joi.date().iso().optional(),
  toOpenedAt: Joi.date().iso().optional(),
  sortBy: Joi.string().valid('openedAt', 'closedAt', 'priority', 'title').default('openedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export interface CaseDecisionDto {
  decision: 'ACCEPT' | 'DECLINE';
  coiDeclaration?: {
    answers?: Record<string, any>;
    hasConflict?: boolean;
    declineReason?: string;
  };
  declineReason?: string;
}

export const CaseDecisionSchema = Joi.object({
  decision: Joi.string().valid('ACCEPT', 'DECLINE').required(),
  coiDeclaration: Joi.object({
    answers: Joi.object().optional(),
    hasConflict: Joi.boolean().default(false),
    declineReason: Joi.string().trim().allow('').optional(),
  }).optional(),
  declineReason: Joi.string().trim().allow('').optional(),
});

export interface MilestoneItemDto {
  title: string;
  description?: string;
  dueDate?: string;
}

export interface ProposeMilestonesDto {
  title?: string;
  description?: string;
  dueDate?: string;
  milestones?: MilestoneItemDto[];
}

export const ProposeMilestonesSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).optional(),
  description: Joi.string().trim().allow('').optional(),
  dueDate: Joi.date().iso().allow(null).optional(),
  milestones: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().trim().min(3).max(255).required(),
        description: Joi.string().trim().allow('').optional(),
        dueDate: Joi.date().iso().allow(null).optional(),
      })
    )
    .min(1)
    .optional(),
}).or('title', 'milestones');

export interface ApproveMilestonesDto {
  milestoneIds?: string[];
  feedback?: string;
}

export const ApproveMilestonesSchema = Joi.object({
  milestoneIds: Joi.array().items(Joi.string()).optional(),
  feedback: Joi.string().trim().allow('').optional(),
});

export interface CompleteMilestoneDto {
  status?: string;
  deliverableNotes?: string;
}

export const CompleteMilestoneSchema = Joi.object({
  status: Joi.string().valid('COMPLETED', 'PENDING_CLIENT_APPROVAL', 'IN_PROGRESS', 'OVERDUE').optional(),
  deliverableNotes: Joi.string().trim().allow('').optional(),
});

export interface AcknowledgeMilestoneDto {
  feedback?: string;
  rating?: number;
  accepted?: boolean;
}

export const AcknowledgeMilestoneSchema = Joi.object({
  feedback: Joi.string().trim().allow('').optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
  accepted: Joi.boolean().default(true),
});

