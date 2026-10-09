import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageModerationService } from './services/message-moderation.service';

@Module({
  controllers: [MessageController],
  providers: [MessageService, MessageModerationService],
  exports: [MessageService, MessageModerationService],
})
export class MessageModule {}

