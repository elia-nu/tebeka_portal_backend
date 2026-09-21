import { ExecutionContext, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './decorators';
import { AppConfigService } from '@workspace/config';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @Optional() private configService?: AppConfigService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const internalKey = request.headers['x-internal-service-key'];
    const expectedSecret =
      this.configService?.internalServiceSecret ||
      process.env.INTERNAL_SERVICE_SECRET ||
      'tebeka-internal-secret-change-in-production';

    if (internalKey && internalKey === expectedSecret) {
      request.user = {
        id: 'internal-service',
        userId: 'internal-service',
        role: 'SERVICE',
        isInternal: true,
      };
      return true;
    }

    return super.canActivate(context);
  }
}

