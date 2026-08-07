import { Controller, Get } from '@nestjs/common';
import { ApiResponse } from '@workspace/common';
import { Public } from '@workspace/auth';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  getHealth() {
    return ApiResponse.ok({ status: 'healthy', timestamp: new Date().toISOString() }, 'API Gateway is up');
  }
}
