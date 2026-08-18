import * as Joi from 'joi';
import { NotificationChannel } from '@prisma/client/communication';

export interface CreateTemplateDto {
  key: string;
  name: string;
  description?: string;
  channels: NotificationChannel[];
  subjectEn?: string;
  subjectAm?: string;
  bodyEn: string;
  bodyAm: string;
  variables?: string[];
}

export const CreateTemplateSchema = Joi.object({
  key: Joi.string().trim().min(3).max(100).required(),
  name: Joi.string().trim().min(3).max(100).required(),
  description: Joi.string().max(255).optional(),
  channels: Joi.array().items(Joi.string().valid('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WEBSOCKET')).min(1).required(),
  subjectEn: Joi.string().allow('').optional(),
  subjectAm: Joi.string().allow('').optional(),
  bodyEn: Joi.string().required(),
  bodyAm: Joi.string().required(),
  variables: Joi.array().items(Joi.string()).default([]),
});

export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  channels?: NotificationChannel[];
  subjectEn?: string;
  subjectAm?: string;
  bodyEn?: string;
  bodyAm?: string;
  variables?: string[];
  isActive?: boolean;
}

export const UpdateTemplateSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).optional(),
  description: Joi.string().max(255).optional(),
  channels: Joi.array().items(Joi.string().valid('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WEBSOCKET')).optional(),
  subjectEn: Joi.string().allow('').optional(),
  subjectAm: Joi.string().allow('').optional(),
  bodyEn: Joi.string().optional(),
  bodyAm: Joi.string().optional(),
  variables: Joi.array().items(Joi.string()).optional(),
  isActive: Joi.boolean().optional(),
});
