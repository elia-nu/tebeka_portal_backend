import { Module } from '@nestjs/common';
import { AttorneysController } from './attorneys.controller';
import { AttorneysService } from './attorneys.service';

@Module({
  controllers: [AttorneysController],
  providers: [AttorneysService],
  exports: [AttorneysService],
})
export class AttorneysModule {}
