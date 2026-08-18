import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { NotificationGateway } from './notification.gateway';
import { PresenceService } from './presence.service';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [MessageModule],
  providers: [ChatGateway, NotificationGateway, PresenceService],
  exports: [ChatGateway, NotificationGateway, PresenceService],
})
export class WebsocketCommunicationModule {}
