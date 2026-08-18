import * as Joi from 'joi';

export interface QuerySearchDto {
  q?: string;
  page?: number;
  limit?: number;
  city?: string;
  feeBand?: string;
  practiceAreaId?: string;
  language?: string;
  rating?: number;
  minRating?: number;
  minExperience?: number;
  minResponsiveness?: number;
  sortBy?: 'searchScore' | 'rating' | 'experienceScore' | 'responsivenessScore';
  sortOrder?: 'asc' | 'desc';
}

export const QuerySearchSchema = Joi.object({
  q: Joi.string().trim().allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  city: Joi.string().trim().optional(),
  feeBand: Joi.string().trim().optional(),
  practiceAreaId: Joi.string().uuid().optional(),
  language: Joi.string().trim().optional(),
  rating: Joi.number().min(0).max(5).optional(),
  minRating: Joi.number().min(0).max(5).optional(),
  minExperience: Joi.number().min(0).optional(),
  minResponsiveness: Joi.number().min(0).optional(),
  sortBy: Joi.string().valid('searchScore', 'rating', 'experienceScore', 'responsivenessScore').default('searchScore'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export interface QuerySearchHistoryDto {
  page?: number;
  limit?: number;
}

export const QuerySearchHistorySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
