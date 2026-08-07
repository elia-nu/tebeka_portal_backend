import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from '@workspace/config';
import { ValidationPipe } from '@nestjs/common';
import { GlobalHttpExceptionFilter } from '@workspace/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api/v1/financial');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  await app.listen(config.financialServicePort);
  console.log(`💳 Financial Service running on port http://localhost:${config.financialServicePort}`);
}
bootstrap();
