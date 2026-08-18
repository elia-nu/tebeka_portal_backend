import { Module, forwardRef } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { TemplateModule } from '../template/template.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { WebsocketCommunicationModule } from '../websocket/websocket.module';

@Module({
  imports: [TemplateModule, DeliveryModule, forwardRef(() => WebsocketCommunicationModule)],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationDispatcherService],
  exports: [NotificationService, NotificationDispatcherService],
})
export class NotificationModule {}
