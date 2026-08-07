import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { AppConfigModule, AppConfigService } from '@workspace/config';
import { AppLoggerModule, AppLoggerService, CorrelationIdMiddleware } from '@workspace/logger';
import { EventBusModule } from '@workspace/event-bus';
import { AuthModule } from '@workspace/auth';
import { WebsocketModule } from '@workspace/websocket';
import { LocalizationModule } from '@workspace/localization';
import { StorageModule } from '@workspace/storage';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    EventBusModule,
    AuthModule,
    WebsocketModule,
    LocalizationModule,
    StorageModule,
    MailerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        transport: {
          host: config.smtpHost,
          port: config.smtpPort,
          secure: false, // 587 uses STARTTLS
          auth: {
            user: config.smtpUser,
            pass: config.smtpPass,
          },
          tls: {
            rejectUnauthorized: false
          }
        },
        defaults: {
          from: `"Tebeka Legal Portal" <${config.mailFrom}>`,
        },
        template: {
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService('COMMUNICATION-SERVICE'),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
