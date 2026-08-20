import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { AppConfigModule, AppConfigService } from '@workspace/config';
import { AppLoggerModule, AppLoggerService, CorrelationIdMiddleware, HttpLoggingInterceptor } from '@workspace/logger';
import { EventBusModule } from '@workspace/event-bus';
import { AuthModule } from '@workspace/auth';
import { LocalizationModule } from '@workspace/localization';
import { StorageModule } from '@workspace/storage';
import { MetricsController, MetricsInterceptor, MetricsModule, TracingMiddleware } from '@workspace/common';

import { ConversationModule } from './modules/conversation/conversation.module';
import { MessageModule } from './modules/message/message.module';
import { TemplateModule } from './modules/template/template.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { NotificationModule } from './modules/notification/notification.module';
import { WebsocketCommunicationModule } from './modules/websocket/websocket.module';
import { CommunicationEventsModule } from './modules/events/events.module';
import { CommunicationSchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    MetricsModule,
    EventBusModule,
    AuthModule,
    LocalizationModule,
    StorageModule,
    ConversationModule,
    MessageModule,
    TemplateModule,
    DeliveryModule,
    NotificationModule,
    WebsocketCommunicationModule,
    CommunicationEventsModule,
    CommunicationSchedulerModule,
    MailerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        transport: config.smtpHost === 'smtp.gmail.com'
          ? {
              service: 'gmail',
              auth: {
                user: config.smtpUser,
                pass: (config.smtpPass || '').replace(/\s+/g, ''),
              },
            }
          : {
              host: config.smtpHost,
              port: config.smtpPort,
              secure: config.smtpPort === 465,
              auth: {
                user: config.smtpUser,
                pass: (config.smtpPass || '').replace(/\s+/g, ''),
              },
              tls: {
                rejectUnauthorized: false,
              },
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
  controllers: [MetricsController],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService('COMMUNICATION-SERVICE'),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, TracingMiddleware).forRoutes('*');
  }
}
