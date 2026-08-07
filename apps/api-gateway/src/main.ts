import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from '@workspace/config';
import { GlobalHttpExceptionFilter } from '@workspace/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tebeka Portal API Gateway')
    .setDescription('Unified API Gateway for Tebeka Legal Marketplace')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.apiGatewayPort);
  console.log(`🚀 API Gateway running on port http://localhost:${config.apiGatewayPort}/api/v1`);
  console.log(`📚 Swagger Docs available at http://localhost:${config.apiGatewayPort}/api/docs`);
}
bootstrap();
