import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from '@workspace/config';
import { GlobalHttpExceptionFilter } from '@workspace/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createProxyMiddleware } from 'http-proxy-middleware';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
  const marketplaceServiceUrl = process.env.MARKETPLACE_SERVICE_URL || 'http://localhost:3002';
  const financialServiceUrl = process.env.FINANCIAL_SERVICE_URL || 'http://localhost:3003';
  const communicationServiceUrl = process.env.COMMUNICATION_SERVICE_URL || 'http://localhost:3004';

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
    })
  );

  // Reverse Proxy Routing for Communication Service
  app.use(
    createProxyMiddleware({
      target: communicationServiceUrl,
      changeOrigin: true,
      ws: true,
      pathFilter: [
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
