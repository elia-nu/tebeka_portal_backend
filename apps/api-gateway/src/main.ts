import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from '@workspace/config';
import { GlobalHttpExceptionFilter } from '@workspace/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createProxyMiddleware } from 'http-proxy-middleware';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { AppLoggerService } from '@workspace/logger';

import { green, blue, yellow, red, magenta, cyan, gray, bold } from 'colorette';

function colorMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return green(method);
    case 'POST': return blue(method);
    case 'PATCH': return yellow(method);
    case 'PUT': return magenta(method);
    case 'DELETE': return red(method);
    default: return cyan(method);
  }
}

function colorStatus(status: number): string {
  if (status >= 500) return bold(red(`[${status}]`));
  if (status >= 400) return bold(yellow(`[${status}]`));
  if (status >= 300) return bold(cyan(`[${status}]`));
  return bold(green(`[${status}]`));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
  const marketplaceServiceUrl = process.env.MARKETPLACE_SERVICE_URL || 'http://localhost:3002';
  const financialServiceUrl = process.env.FINANCIAL_SERVICE_URL || 'http://localhost:3003';
  const communicationServiceUrl = process.env.COMMUNICATION_SERVICE_URL || 'http://localhost:3004';

  // Live Winston HTTP Traffic Logging Middleware
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    const correlationId = (req.headers['x-correlation-id'] as string) || `req-${Math.random().toString(36).substring(2, 8)}`;
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    const url = req.originalUrl || req.url;
    if (!url.endsWith('/metrics')) {
      const hasBody = req.body && Object.keys(req.body).length > 0;
      const bodyStr = hasBody ? ` | Payload: ${JSON.stringify(req.body)}` : '';
      logger.log(`📥 INCOMING ${colorMethod(req.method)} ${cyan(url)}${gray(bodyStr)}`, 'GATEWAY-PROXY');
    }

    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      if (url.endsWith('/metrics') && status === 200) return;

      if (status >= 400) {
        logger.warn(`📤 RESPONSE ${colorMethod(req.method)} ${cyan(url)} -> ${colorStatus(status)} ${cyan(`(${duration}ms)`)}`, 'GATEWAY-PROXY');
      } else {
        logger.log(`📤 RESPONSE ${colorMethod(req.method)} ${cyan(url)} -> ${colorStatus(status)} ${cyan(`(${duration}ms)`)}`, 'GATEWAY-PROXY');
      }
    });
    next();
  });

  // Security/CORS/rate-limit middleware must be registered before the proxy
  // middlewares below: http-proxy-middleware intercepts and responds to matching
  // requests directly via app.use(), bypassing Nest's routing/guards entirely, so
  // anything meant to also cover proxied traffic has to run ahead of it in the
  // Express middleware chain rather than as a NestJS global pipe/guard.
  app.use(helmet());
  app.enableCors({
    origin: config.corsAllowedOrigins,
    credentials: true,
  });
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Reverse Proxy Routing for User Service
  app.use(
    createProxyMiddleware({
      target: userServiceUrl,
      changeOrigin: true,
      pathFilter: [
        '/api/v1/auth/**',
        '/api/v1/users/**',
        '/api/v1/attorneys/**',
        '/api/v1/verifications/**',
        '/api/v1/settings/**',
        '/api/v1/admin/**',
        '/api/v1/roles/**',
        '/api/v1/permissions/**',
        '/api/v1/audit-logs/**',
        '/api/v1/localization/**',
        '/api/v1/i18n/**',
        '/api/v1/translations/**',
        '/api/v1/queues/**',
        '/api/v1/files/**',
        '/api/v1/public/**',
        '/api/v1/blogs/**',
      ],
    })
  );

  // Reverse Proxy Routing for Marketplace Service
  app.use(
    createProxyMiddleware({
      target: marketplaceServiceUrl,
      changeOrigin: true,
      pathFilter: [
        '/api/v1/discovery/**',
        '/api/v1/search/**',
        '/api/v1/ranking/**',
        '/api/v1/bookings/**',
        '/api/v1/cases/**',
        '/api/v1/reviews/**',
        '/api/v1/marketplace/**',
      ],
      pathRewrite: {
        '^/api/v1/marketplace': '/api/v1',
      },
    })
  );

  // Reverse Proxy Routing for Financial Service
  app.use(
    createProxyMiddleware({
      target: financialServiceUrl,
      changeOrigin: true,
      pathFilter: [
        '/api/v1/financial/**',
        '/api/v1/payments/**',
        '/api/v1/wallets/**',
        '/api/v1/escrow/**',
        '/api/v1/subscriptions/**',
        '/api/v1/refunds/**',
      ],
      pathRewrite: {
        '^/api/v1/financial': '/api/v1',
      },
    })
  );

  // Reverse Proxy Routing for Communication Service
  app.use(
    createProxyMiddleware({
      target: communicationServiceUrl,
      changeOrigin: true,
      ws: true,
      pathFilter: [
        '/api/v1/communication/**',
        '/api/v1/conversations/**',
        '/api/v1/messages/**',
        '/api/v1/notifications/**',
        '/api/v1/notification-templates/**',
        '/api/v1/chat/**',
        '/chat/**',
        '/notifications/**',
      ],
    })
  );

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  if (config.nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Tebeka Portal API Gateway')
      .setDescription('Unified API Gateway for Tebeka Legal Marketplace')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`📚 Swagger Docs available at http://localhost:${config.apiGatewayPort}/api/docs`);
  }

  await app.listen(config.apiGatewayPort);
  console.log(`🚀 API Gateway running on port http://localhost:${config.apiGatewayPort}/api/v1`);
}
bootstrap();
