import { Controller, Get, Header, SetMetadata } from '@nestjs/common';
import { MetricsService, globalMetrics } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService = globalMetrics) {}

  @SetMetadata('isPublic', true)
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics() {
    return this.metricsService.getMetricsAsPrometheusText();
  }
}
