import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/marketplace';
import { EventBusService } from '@workspace/event-bus';

const prisma = new PrismaClient();

@Injectable()
export class MarketplaceEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceEventsConsumer.name);

  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit() {
    this.subscribeToUserEvents();
  }

  private subscribeToUserEvents() {
    this.eventBus.subscribe('ATTORNEY_VERIFIED', async (data: any) => {
      this.logger.log(`Handling ATTORNEY_VERIFIED event for attorney: ${data.attorneyId || data.aggregateId}`);
      const attorneyId = data.attorneyId || data.aggregateId;
      if (!attorneyId) return;

      await prisma.discoveryIndex.upsert({
        where: { attorneyId },
        update: {
          verifiedAt: new Date(),
        },
        create: {
          attorneyId,
          verifiedAt: new Date(),
          practiceAreaIds: data.practiceAreaIds || [],
          city: data.city || 'Addis Ababa',
          languages: data.languages || ['en', 'am'],
        },
      });
    });

    this.eventBus.subscribe('ATTORNEY_PROFILE_UPDATED', async (data: any) => {
      this.logger.log(`Handling ATTORNEY_PROFILE_UPDATED event for attorney: ${data.attorneyId || data.aggregateId}`);
      const attorneyId = data.attorneyId || data.aggregateId;
      if (!attorneyId) return;

      await prisma.discoveryIndex.upsert({
        where: { attorneyId },
        update: {
          ...(data.city && { city: data.city }),
          ...(data.feeBand && { feeBand: data.feeBand }),
          ...(data.languages && { languages: data.languages }),
          ...(data.practiceAreaIds && { practiceAreaIds: data.practiceAreaIds }),
        },
        create: {
          attorneyId,
          city: data.city || 'Addis Ababa',
          feeBand: data.feeBand || 'TIER_1',
          languages: data.languages || ['en', 'am'],
          practiceAreaIds: data.practiceAreaIds || [],
        },
      });
    });
  }
}
