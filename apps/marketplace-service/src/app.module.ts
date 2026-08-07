import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppConfigModule } from '@workspace/config';
import { AppLoggerModule, AppLoggerService, CorrelationIdMiddleware } from '@workspace/logger';
import { EventBusModule } from '@workspace/event-bus';
import { AuthModule } from '@workspace/auth';
import { StorageModule } from '@workspace/storage';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    EventBusModule,
    AuthModule,
    StorageModule,
  ],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService('MARKETPLACE-SERVICE'),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
