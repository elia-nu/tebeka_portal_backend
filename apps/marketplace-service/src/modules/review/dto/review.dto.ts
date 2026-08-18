import * as Joi from 'joi';
import { ReviewStatus } from '@prisma/client/marketplace';

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
