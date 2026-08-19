import { Module } from '@nestjs/common';
import { BlogsController } from './blogs.controller';
import { AdminBlogsController } from './admin-blogs.controller';
import { BlogsService } from './blogs.service';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';

@Module({
  controllers: [BlogsController, AdminBlogsController],
  providers: [BlogsService, CommunicationServiceClient],
  exports: [BlogsService],
})
export class BlogModule {}
