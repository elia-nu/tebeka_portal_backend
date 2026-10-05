import * as Joi from 'joi';
import { ReviewStatus, ReportStatus } from '@prisma/client/marketplace';

export interface CreateReviewDto {
  rating: number;
  comment?: string;
  clientId?: string;
}

export const CreateReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.min': 'rating must be an integer between 1 and 5',
    'number.max': 'rating must be an integer between 1 and 5',
  }),
  comment: Joi.string().trim().max(1000).optional(),
  clientId: Joi.string().uuid().optional(),
});

export interface QueryReviewDto {
  page?: number;
  limit?: number;
  clientId?: string;
  status?: ReviewStatus;
  rating?: number;
  minRating?: number;
  sortBy?: 'createdAt' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export const QueryReviewSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  clientId: Joi.string().uuid().optional(),
  status: Joi.string().valid('PENDING', 'PUBLISHED', 'FLAGGED', 'HIDDEN').default('PUBLISHED'),
  rating: Joi.number().integer().min(1).max(5).optional(),
  minRating: Joi.number().integer().min(1).max(5).optional(),
  sortBy: Joi.string().valid('createdAt', 'rating').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export interface QueryReviewReportDto {
  page?: number;
  limit?: number;
  status?: ReportStatus;
  reviewId?: string;
  reportedBy?: string;
  sortBy?: 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export const QueryReviewReportSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED').optional(),
  reviewId: Joi.string().uuid().optional(),
  reportedBy: Joi.string().uuid().optional(),
  sortBy: Joi.string().valid('createdAt', 'status').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export interface UpdateReviewReportDto {
  status: ReportStatus;
  actionTaken?: string;
  adminNotes?: string;
  reviewStatus?: ReviewStatus;
}

export const UpdateReviewReportSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'REVIEWED', 'DISMISSED', 'ACTIONED').required(),
  actionTaken: Joi.string().trim().max(255).optional(),
  adminNotes: Joi.string().trim().max(1000).optional(),
  reviewStatus: Joi.string().valid('PENDING', 'PUBLISHED', 'FLAGGED', 'HIDDEN').optional(),
});
