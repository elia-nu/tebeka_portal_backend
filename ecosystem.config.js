const fs = require('fs');
const path = require('path');

// Native .env parser without external dependencies
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

function getScriptPath(app) {
  const candidates = [
    `dist/apps/${app}/apps/${app}/src/main.js`,
    `dist/apps/${app}/src/main.js`,
    `dist/apps/${app}/main.js`
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.resolve(__dirname, c))) {
      return c;
    }
  }
  return candidates[0];
}

module.exports = {
  apps: [
    {
      name: 'tebeka-gateway',
      cwd: __dirname,
      script: getScriptPath('api-gateway'),
      node_args: ['-r', 'ts-node/register/transpile-only', '-r', 'tsconfig-paths/register', '--max-old-space-size=512'],
      env: {
        NODE_ENV: 'production',
        PORT: process.env.API_GATEWAY_PORT || process.env.PORT || 7000,
        API_GATEWAY_PORT: process.env.API_GATEWAY_PORT || process.env.PORT || 7000,
        JWT_SECRET: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
        USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://127.0.0.1:7001',
        MARKETPLACE_SERVICE_URL: process.env.MARKETPLACE_SERVICE_URL || 'http://127.0.0.1:7002',
        FINANCIAL_SERVICE_URL: process.env.FINANCIAL_SERVICE_URL || 'http://127.0.0.1:7003',
        COMMUNICATION_SERVICE_URL: process.env.COMMUNICATION_SERVICE_URL || 'http://127.0.0.1:7004',
        REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT: process.env.REDIS_PORT || 6379,
        INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET || 'tebeka-internal-secret-change-in-production',
      },
    },
    {
      name: 'tebeka-user',
      cwd: __dirname,
      script: getScriptPath('user-service'),
      node_args: ['-r', 'ts-node/register/transpile-only', '-r', 'tsconfig-paths/register', '--max-old-space-size=512'],
      env: {
        NODE_ENV: 'production',
        USER_SERVICE_PORT: process.env.USER_SERVICE_PORT || 7001,
        JWT_SECRET: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
        DATABASE_URL_USER: process.env.DATABASE_URL_USER || 'postgresql://postgres:postgres@127.0.0.1:15432/tebeka_user_db?schema=public',
        DATABASE_URL: process.env.DATABASE_URL_USER || 'postgresql://postgres:postgres@127.0.0.1:15432/tebeka_user_db?schema=public',
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://127.0.0.1:7001',
        REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT: process.env.REDIS_PORT || 6379,
        RABBITMQ_URI: process.env.RABBITMQ_URI || 'amqp://guest:guest@127.0.0.1:5672',
        INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET || 'tebeka-internal-secret-change-in-production',
      },
    },
    {
      name: 'tebeka-marketplace',
      cwd: __dirname,
      script: getScriptPath('marketplace-service'),
      node_args: ['-r', 'ts-node/register/transpile-only', '-r', 'tsconfig-paths/register', '--max-old-space-size=512'],
      env: {
        NODE_ENV: 'production',
        MARKETPLACE_SERVICE_PORT: process.env.MARKETPLACE_SERVICE_PORT || 7002,
        JWT_SECRET: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
        DATABASE_URL_MARKETPLACE: process.env.DATABASE_URL_MARKETPLACE || 'postgresql://postgres:postgres@127.0.0.1:15432/tebeka_marketplace_db?schema=public',
        DATABASE_URL: process.env.DATABASE_URL_MARKETPLACE || 'postgresql://postgres:postgres@127.0.0.1:15432/tebeka_marketplace_db?schema=public',
        USER_SERVICE_INTERNAL_URL: process.env.USER_SERVICE_INTERNAL_URL || 'http://127.0.0.1:7001/api/v1',
        FINANCIAL_SERVICE_INTERNAL_URL: process.env.FINANCIAL_SERVICE_INTERNAL_URL || 'http://127.0.0.1:7003/api/v1',
        COMMUNICATION_SERVICE_INTERNAL_URL: process.env.COMMUNICATION_SERVICE_INTERNAL_URL || 'http://127.0.0.1:7004/api/v1/communication',
        REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT: process.env.REDIS_PORT || 6379,
        RABBITMQ_URI: process.env.RABBITMQ_URI || 'amqp://guest:guest@127.0.0.1:5672',
        INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET || 'tebeka-internal-secret-change-in-production',
      },
    },
    {
      name: 'tebeka-financial',
      cwd: __dirname,
      script: getScriptPath('financial-service'),
      node_args: ['-r', 'ts-node/register/transpile-only', '-r', 'tsconfig-paths/register', '--max-old-space-size=512'],
      env: {
        NODE_ENV: 'production',
        FINANCIAL_SERVICE_PORT: process.env.FINANCIAL_SERVICE_PORT || 7003,
        JWT_SECRET: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
        DATABASE_URL_FINANCIAL: process.env.DATABASE_URL_FINANCIAL || 'postgresql://postgres:postgres@127.0.0.1:15432/tebeka_financial_db?schema=public',
        DATABASE_URL: process.env.DATABASE_URL_FINANCIAL || 'postgresql://postgres:postgres@127.0.0.1:15432/tebeka_financial_db?schema=public',
        REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT: process.env.REDIS_PORT || 6379,
        RABBITMQ_URI: process.env.RABBITMQ_URI || 'amqp://guest:guest@127.0.0.1:5672',
        INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET || 'tebeka-internal-secret-change-in-production',
        CHAPA_KEY: process.env.CHAPA_KEY,
        CHAPA_PUBLIC_KEY: process.env.CHAPA_PUBLIC_KEY,
        CHAPA_SECRET: process.env.CHAPA_SECRET,
        CHAPA_SECRET_KEY: process.env.CHAPA_SECRET_KEY,
        CHAPA_WEBHOOK_SECRET_HASH: process.env.CHAPA_WEBHOOK_SECRET_HASH,
        STRIPE_KEY: process.env.STRIPE_KEY,
        STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
        STRIPE_SECRET: process.env.STRIPE_SECRET,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      },
    },
    {
      name: 'tebeka-communication',
      cwd: __dirname,
      script: getScriptPath('communication-service'),
      node_args: ['-r', 'ts-node/register/transpile-only', '-r', 'tsconfig-paths/register', '--max-old-space-size=512'],
      env: {
        NODE_ENV: 'production',
        COMMUNICATION_SERVICE_PORT: process.env.COMMUNICATION_SERVICE_PORT || 7004,
        JWT_SECRET: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
        DATABASE_URL_COMMUNICATION: process.env.DATABASE_URL_COMMUNICATION || 'postgresql://postgres:postgres@127.0.0.1:15432/tebeka_communication_db?schema=public',
        DATABASE_URL: process.env.DATABASE_URL_COMMUNICATION || 'postgresql://postgres:postgres@127.0.0.1:15432/tebeka_communication_db?schema=public',
        MONGODB_URI: process.env.MONGODB_URI || 'mongodb://root:rootpassword@127.0.0.1:27017/tebeka_communication?authSource=admin',
        REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
        REDIS_PORT: process.env.REDIS_PORT || 6379,
        RABBITMQ_URI: process.env.RABBITMQ_URI || 'amqp://guest:guest@127.0.0.1:5672',
        INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET || 'tebeka-internal-secret-change-in-production',
      },
    },
  ],
};
