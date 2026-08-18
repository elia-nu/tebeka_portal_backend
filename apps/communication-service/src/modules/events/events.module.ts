import { Module } from '@nestjs/common';
import { UserEventsConsumer } from './consumers/user-events.consumer';
import { MarketplaceEventsConsumer } from './consumers/marketplace-events.consumer';
import { FinancialEventsConsumer } from './consumers/financial-events.consumer';
import { ConversationModule } from '../conversation/conversation.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [ConversationModule, NotificationModule],
  providers: [UserEventsConsumer, MarketplaceEventsConsumer, FinancialEventsConsumer],
  exports: [UserEventsConsumer, MarketplaceEventsConsumer, FinancialEventsConsumer],
})
export class CommunicationEventsModule {}
