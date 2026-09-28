import { Controller, Get, Optional } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '@workspace/auth';
import { PrismaService } from '@workspace/database';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    @Optional() private prisma?: PrismaService
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      async () => {
        if (this.prisma) {
          try {
            await this.prisma.$queryRaw`SELECT 1`;
            return { database: { status: 'up' } };
          } catch (err: any) {
            return { database: { status: 'down', message: err?.message } };
          }
        }
        return { service: { status: 'up' } };
      },
    ]);
  }
}
