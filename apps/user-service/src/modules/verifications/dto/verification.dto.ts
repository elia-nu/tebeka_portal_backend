import * as Joi from 'joi';

export interface UpdateChecklistDto {
  status: 'PASSED' | 'FAILED';
  remarks?: string;
}

export const UpdateChecklistSchema = Joi.object({
  status: Joi.string().valid('PASSED', 'FAILED').required(),
  remarks: Joi.string().trim().max(500).optional(),
});

export interface UpdateBarStandingDto {
  status: string;
  notes?: string;
}

export const UpdateBarStandingSchema = Joi.object({
  status: Joi.string().valid('ACTIVE', 'SUSPENDED', 'INACTIVE', 'REVOKED').required(),
  notes: Joi.string().trim().max(500).optional(),
});

export interface RejectVerificationDto {
  reason: string;
}

export const RejectVerificationSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(1000).required().messages({
    'string.min': 'Rejection reason must be at least 10 characters long',
  }),
});

export interface FlagFraudDto {
  signalTypes: string[];
  notes?: string;
}

export const FlagFraudSchema = Joi.object({
  signalTypes: Joi.array().items(Joi.string().trim()).min(1).required(),
  notes: Joi.string().trim().max(1000).optional(),
});

export interface QueryVerificationDto {
  page?: number;
  limit?: number;
  status?: string;
  fraudStatus?: string;
  assignedReviewerId?: string;
  sortBy?: 'submittedAt' | 'slaDueDate' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export const QueryVerificationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().trim().optional(),
  fraudStatus: Joi.string().trim().optional(),
  assignedReviewerId: Joi.string().uuid().optional(),
  sortBy: Joi.string().valid('submittedAt', 'slaDueDate', 'status').default('submittedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export interface RequestAmendmentDto {
  notes: string;
  requestedFields?: string[];
}

export const RequestAmendmentSchema = Joi.object({
  notes: Joi.string().trim().min(10).max(1000).required().messages({
    'string.min': 'Amendment request notes must be at least 10 characters long',
  }),
  requestedFields: Joi.array().items(Joi.string().trim()).optional(),
});
