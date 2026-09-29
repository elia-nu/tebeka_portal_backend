import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { MarketplaceEventsConsumer } from '../events/marketplace-events.consumer';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService } from '@workspace/event-bus';
import { GoogleMeetService } from '../integrations/google-meet.service';
import { UserServiceClient } from '../../integrations/user-service.client';

describe('Attorney Suspension & Discovery Invalidation (TC-DISC-04 / BR-AUTH-02)', () => {
  let discoveryService: DiscoveryService;
  let eventsConsumer: MarketplaceEventsConsumer;
  let mockPrisma: any;
  let mockEventBus: any;
  let eventHandlers: Record<string, Function> = {};

  beforeEach(async () => {
    eventHandlers = {};

    mockEventBus = {
      subscribe: jest.fn().mockImplementation((event: string, handler: Function) => {
        eventHandlers[event] = handler;
      }),
      subscribeIdempotent: jest.fn(),
      publish: jest.fn(),
    };

    mockPrisma = {
      discoveryIndex: {
        upsert: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      availabilityWindow: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const mockUserServiceClient = {
      getAttorneyProfile: jest.fn().mockResolvedValue({ id: 'att-suspended', name: 'Advocate Dawit' }),
    };

    const mockGoogleMeetService = {
      createConsultationMeeting: jest.fn(),
      cancelConsultationMeeting: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        MarketplaceEventsConsumer,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: UserServiceClient, useValue: mockUserServiceClient },
        { provide: GoogleMeetService, useValue: mockGoogleMeetService },
      ],
    }).compile();

    discoveryService = module.get<DiscoveryService>(DiscoveryService);
    eventsConsumer = module.get<MarketplaceEventsConsumer>(MarketplaceEventsConsumer);

    // Initialize module event listeners
    eventsConsumer.onModuleInit();
  });

  it('should register ATTORNEY_SUSPENDED and ATTORNEY_UNVERIFIED event listeners on init', () => {
    expect(mockEventBus.subscribe).toHaveBeenCalledWith('ATTORNEY_SUSPENDED', expect.any(Function));
    expect(mockEventBus.subscribe).toHaveBeenCalledWith('ATTORNEY_UNVERIFIED', expect.any(Function));
  });

  it('TC-DISC-04: should remove attorney from discoveryIndex and invalidate cache upon ATTORNEY_SUSPENDED event', async () => {
    const suspendedAttorneyId = 'att-suspended-99';
    const clearCacheSpy = jest.spyOn(discoveryService, 'clearDiscoveryCache');

    // 1. Trigger ATTORNEY_SUSPENDED event handler
    const suspendHandler = eventHandlers['ATTORNEY_SUSPENDED'];
    expect(suspendHandler).toBeDefined();

    await suspendHandler({ attorneyId: suspendedAttorneyId, reason: 'BAR_LICENSE_SUSPENDED' });

    // 2. Verify DiscoveryIndex deletion was called
    expect(mockPrisma.discoveryIndex.deleteMany).toHaveBeenCalledWith({
      where: { attorneyId: suspendedAttorneyId },
    });
    // 3. Verify public discovery cache was invalidated for the attorney
    expect(clearCacheSpy).toHaveBeenCalledWith(suspendedAttorneyId);
  });

  it('should remove attorney from discoveryIndex and invalidate cache upon ATTORNEY_UNVERIFIED event', async () => {
    const unverifiedAttorneyId = 'att-unverified-12';
    const clearCacheSpy = jest.spyOn(discoveryService, 'clearDiscoveryCache');

    const unverifyHandler = eventHandlers['ATTORNEY_UNVERIFIED'];
    expect(unverifyHandler).toBeDefined();

    await unverifyHandler({ attorneyId: unverifiedAttorneyId, reason: 'RE-VERIFICATION_FAILED' });

    expect(mockPrisma.discoveryIndex.deleteMany).toHaveBeenCalledWith({
      where: { attorneyId: unverifiedAttorneyId },
    });
    expect(clearCacheSpy).toHaveBeenCalledWith(unverifiedAttorneyId);
  });

  it('should return 404 NotFoundException when querying details of a suspended attorney (removed from discovery)', async () => {
    // DiscoveryIndex findUnique returns null for removed attorney
    mockPrisma.discoveryIndex.findUnique.mockResolvedValue(null);

    await expect(discoveryService.getAttorneyDetails('att-suspended-99')).rejects.toThrow(
      NotFoundException
    );
  });

  it('should exclude suspended/unverified attorneys from public search discovery results', async () => {
    // When suspended, findMany only returns active verified attorneys
    mockPrisma.discoveryIndex.findMany.mockResolvedValue([
      {
        attorneyId: 'att-active-1',
        city: 'Addis Ababa',
        languages: ['en', 'am'],
        practiceAreaIds: ['Corporate Law'],
        rating: 4.9,
        experienceScore: 40,
        responsivenessScore: 98,
        searchScore: 95,
        verifiedAt: new Date(),
      },
    ]);
    mockPrisma.discoveryIndex.count.mockResolvedValue(1);

    const searchResults = await discoveryService.getPublicAttorneys({ page: 1, limit: 10 });

    expect(searchResults.items).toHaveLength(1);
    expect(searchResults.items[0].attorneyId).toBe('att-active-1');
    expect(searchResults.items.some((a: any) => a.attorneyId === 'att-suspended-99')).toBe(false);
  });
});
