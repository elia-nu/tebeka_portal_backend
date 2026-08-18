import * as Joi from 'joi';

export interface UploadCaseDocumentDto {
  fileName?: string;
  fileKey?: string;
  mimeType?: string;
  size?: number;
  uploadedBy?: string;
}

export const UploadCaseDocumentSchema = Joi.object({
  fileName: Joi.string().trim().optional(),
  fileKey: Joi.string().trim().optional(),
  mimeType: Joi.string().trim().default('application/pdf'),
  size: Joi.number().integer().min(1).default(1024),
  uploadedBy: Joi.string().uuid().optional(),
});

export interface QueryCaseDocumentDto {
  page?: number;
  limit?: number;
  uploadedBy?: string;
  mimeType?: string;
  q?: string;
  search?: string;
  sortBy?: 'createdAt' | 'size' | 'fileName';
  sortOrder?: 'asc' | 'desc';
}

export const QueryCaseDocumentSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  uploadedBy: Joi.string().uuid().optional(),
  mimeType: Joi.string().trim().optional(),
  q: Joi.string().trim().allow('').optional(),
  search: Joi.string().trim().allow('').optional(),
  sortBy: Joi.string().valid('createdAt', 'size', 'fileName').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});
