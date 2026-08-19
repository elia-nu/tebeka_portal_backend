import * as Joi from 'joi';

export interface QueryDiscoveryDto {
  page?: number;
  limit?: number;
  city?: string;
  region?: string;
  feeBand?: string;
  practiceAreaId?: string;
  practiceArea?: string;
  language?: string;
  rating?: number;
  minRating?: number;
  minExperience?: number;
  minResponsiveness?: number;
  availabilityWindow?: 'TODAY' | 'THIS_WEEK' | 'NEXT_7_DAYS' | 'ALL';
  q?: string;
  search?: string;
  sortBy?: 'searchScore' | 'rating' | 'experienceScore' | 'responsivenessScore';
  sortOrder?: 'asc' | 'desc';
}

export const QueryDiscoverySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  city: Joi.string().trim().allow('').optional(),
  region: Joi.string().trim().allow('').optional(),
  feeBand: Joi.string().trim().allow('').optional(),
  practiceAreaId: Joi.string().uuid().optional(),
  practiceArea: Joi.string().trim().allow('').optional(),
  language: Joi.string().trim().allow('').optional(),
  rating: Joi.number().min(0).max(5).optional(),
  minRating: Joi.number().min(0).max(5).optional(),
  minExperience: Joi.number().min(0).optional(),
  minResponsiveness: Joi.number().min(0).optional(),
  availabilityWindow: Joi.string().valid('TODAY', 'THIS_WEEK', 'NEXT_7_DAYS', 'ALL').default('ALL'),
  q: Joi.string().trim().allow('').optional(),
  search: Joi.string().trim().allow('').optional(),
  sortBy: Joi.string().valid('searchScore', 'rating', 'experienceScore', 'responsivenessScore').default('searchScore'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

export interface QuestionnaireDiscoveryDto {
  matterType: string;
  urgency: 'IMMEDIATE_24H' | 'THIS_WEEK' | 'FLEXIBLE';
  city?: string;
  region?: string;
  language?: string;
  maxBudget?: number;
}

export const QuestionnaireDiscoverySchema = Joi.object({
  matterType: Joi.string().trim().min(2).max(100).required(),
  urgency: Joi.string().valid('IMMEDIATE_24H', 'THIS_WEEK', 'FLEXIBLE').default('THIS_WEEK'),
  city: Joi.string().trim().allow('').optional(),
  region: Joi.string().trim().allow('').optional(),
  language: Joi.string().trim().allow('').optional(),
  maxBudget: Joi.number().positive().optional(),
});
