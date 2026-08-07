import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from '@workspace/config';
import { ValidationPipe } from '@nestjs/common';
import { GlobalHttpExceptionFilter } from '@workspace/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  await app.listen(config.userServicePort, '0.0.0.0');
  console.log(`👤 User Service running on port http://localhost:${config.userServicePort}/api/v1`);
}
bootstrap();
