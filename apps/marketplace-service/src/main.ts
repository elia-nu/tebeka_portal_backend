import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from '@workspace/config';
import { ValidationPipe } from '@nestjs/common';
import { GlobalHttpExceptionFilter } from '@workspace/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'x-custom-locale', 'ngrok-skip-browser-warning'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  await app.listen(config.marketplaceServicePort, '0.0.0.0');
  console.log(`⚖️ Marketplace Service running on port http://localhost:${config.marketplaceServicePort}/api/v1`);
}
bootstrap();
