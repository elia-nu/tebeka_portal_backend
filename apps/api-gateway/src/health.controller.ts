import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { Public } from '@workspace/auth';

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([]);
  }
}
