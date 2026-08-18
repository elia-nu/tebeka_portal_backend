import { Module } from '@nestjs/common';
import { AuthModule } from '@workspace/auth';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  // AuthModule registers the 'jwt' Passport strategy that JwtAuthGuard depends on -
  // without it, @UseGuards(JwtAuthGuard) throws "Unknown authentication strategy"
  // at request time instead of enforcing anything.
  imports: [AuthModule],
  controllers: [RbacController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
