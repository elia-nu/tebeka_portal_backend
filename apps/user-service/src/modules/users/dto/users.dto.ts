import * as Joi from 'joi';

export interface UpdateUserDto {
  name?: string;
  displayName?: string;
  gender?: string;
  dateOfBirth?: Date | string;
  preferredCommunication?: string;
  emergencyContact?: string;
  image?: string;
  email?: string;
  phone?: string;
  city?: string;
  profilePicture?: string;
  locale?: string;
}

export const UpdateUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).allow(null, '').optional(),
  displayName: Joi.string().trim().min(1).max(100).allow(null, '').optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY').allow(null, '').optional(),
  dateOfBirth: Joi.alternatives().try(Joi.date(), Joi.string()).allow(null, '').optional(),
  preferredCommunication: Joi.string().valid('EMAIL', 'SMS', 'PHONE', 'WHATSAPP').allow(null, '').optional(),
  emergencyContact: Joi.string().trim().allow(null, '').optional(),
  image: Joi.string().trim().allow(null, '').optional(),
  email: Joi.string().email().lowercase().trim().optional(),
  phone: Joi.string().regex(/^\+?[1-9]\d{6,14}$/).optional(),
  city: Joi.string().trim().allow(null, '').optional(),
  profilePicture: Joi.string().uri().allow(null, '').optional(),
  locale: Joi.string().trim().allow(null, '').optional(),
}).unknown(true);

export interface QueryUserDto {
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
  q?: string;
  sortBy?: 'createdAt' | 'name' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export const QueryUserSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  role: Joi.string().valid('CLIENT', 'ATTORNEY', 'ADMIN', 'SUPER_ADMIN').optional(),
  status: Joi.string().trim().optional(),
  q: Joi.string().trim().allow('').optional(),
  sortBy: Joi.string().valid('createdAt', 'name', 'email').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});
