import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth';
import { AppConfigModule } from '@workspace/config';
import { AppLoggerModule, AppLoggerService, CorrelationIdMiddleware } from '@workspace/logger';
import { EventBusModule } from '@workspace/event-bus';
import { CacheModule } from '@workspace/cache';

import { UserAuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AttorneysModule } from './modules/attorneys/attorneys.module';
import { VerificationsModule } from './modules/verifications/verifications.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { CmsModule } from './modules/cms/cms.module';
import { ConfigurationModule } from './modules/configuration/configuration.module';
import { QueuesModule } from './modules/queues/queues.module';
import { AuditModule } from './modules/audit/audit.module';
import { LocalizationModule } from './modules/localization/localization.module';
import { StorageModule } from './modules/storage/storage.module';
import { SearchModule } from './modules/search/search.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    AppConfigModule,
    AppLoggerModule,
    EventBusModule,
    CacheModule,
    UserAuthModule,
    UsersModule,
    AttorneysModule,
    VerificationsModule,
    RbacModule,
    AdministrationModule,
    CmsModule,
    ConfigurationModule,
    QueuesModule,
    AuditModule,
    LocalizationModule,
    StorageModule,
    SearchModule,
    DiscoveryModule,
  ],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService('USER-SERVICE'),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
