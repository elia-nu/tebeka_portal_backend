import { Module } from '@nestjs/common';
import { StorageModule as SharedStorageModule } from '@workspace/storage';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [SharedStorageModule, UsersModule],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}

