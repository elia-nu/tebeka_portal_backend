import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: MetricsService,
      useFactory: () => new MetricsService(process.env.SERVICE_NAME || 'tebeka-service'),
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
