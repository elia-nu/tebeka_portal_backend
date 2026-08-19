import { Module } from '@nestjs/common';
import { BlogsController } from './blogs.controller';
import { AdminBlogsController } from './admin-blogs.controller';
import { BlogsService } from './blogs.service';
import { BlogCategoriesService } from './services/blog-categories.service';
import { BlogModerationService } from './services/blog-moderation.service';
import { BlogInteractionsService } from './services/blog-interactions.service';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';

@Module({
  controllers: [BlogsController, AdminBlogsController],
  providers: [
    BlogsService,
    BlogCategoriesService,
    BlogModerationService,
    BlogInteractionsService,
    CommunicationServiceClient,
  ],
  exports: [
    BlogsService,
    BlogCategoriesService,
    BlogModerationService,
    BlogInteractionsService,
  ],
})
export class BlogModule {}
