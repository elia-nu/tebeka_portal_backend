import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  API_GATEWAY_PORT: Joi.number().default(3000),
  USER_SERVICE_PORT: Joi.number().default(3001),
  MARKETPLACE_SERVICE_PORT: Joi.number().default(3002),
  FINANCIAL_SERVICE_PORT: Joi.number().default(3003),
  COMMUNICATION_SERVICE_PORT: Joi.number().default(3004),

  JWT_SECRET: Joi.string().required().default('super-secret-jwt-key-change-in-production'),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  DATABASE_URL_USER: Joi.string().required().default('postgresql://postgres:postgres@localhost:5432/user_db?schema=public'),
  DATABASE_URL_MARKETPLACE: Joi.string().required().default('postgresql://postgres:postgres@localhost:5432/marketplace_db?schema=public'),
  DATABASE_URL_FINANCIAL: Joi.string().required().default('postgresql://postgres:postgres@localhost:5432/financial_db?schema=public'),
  DATABASE_URL_COMMUNICATION: Joi.string().required().default('postgresql://postgres:postgres@localhost:5432/communication_db?schema=public'),

  MONGODB_URI: Joi.string().default('mongodb://localhost:27017/tebeka_communication'),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  RABBITMQ_URI: Joi.string().default('amqp://guest:guest@localhost:5672'),

  LOCAL_UPLOAD_DIR: Joi.string().default('./uploads'),

  SMTP_HOST: Joi.string().default('localhost'),
  SMTP_PORT: Joi.number().default(1025),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().default('noreply@tebeka.et'),
});
