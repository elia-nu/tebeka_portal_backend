import { Module } from '@nestjs/common';
import { StorageModule } from '@workspace/storage';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';

@Module({
  imports: [StorageModule],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
