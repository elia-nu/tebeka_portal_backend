import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from './discovery.service';
import { PrismaService } from '../../database/prisma.service';
import { UserServiceClient } from '../../integrations/user-service.client';

describe('DiscoveryService - 60s Cache & Cache Purge', () => {
  let service: DiscoveryService;
  let mockPrisma: any;
  let mockUserServiceClient: any;

  beforeEach(async () => {
    mockPrisma = {
      discoveryIndex: {
        findMany: jest.fn().mockResolvedValue([
          {
            attorneyId: 'att-1',
            city: 'Addis Ababa',
            languages: ['en', 'am'],
            practiceAreaIds: ['Corporate Law'],
            rating: 4.8,
            experienceScore: 50,
            responsivenessScore: 95,
            searchScore: 92,
            verifiedAt: new Date(),
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue({
          attorneyId: 'att-1',
          city: 'Addis Ababa',
          rating: 4.8,
          verifiedAt: new Date(),
        }),
      },
      availabilityWindow: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockUserServiceClient = {
      getAttorneyProfile: jest.fn().mockResolvedValue({ id: 'att-1', name: 'Dr. Dawit' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserServiceClient, useValue: mockUserServiceClient },
      ],
    }).compile();

    service = module.get<DiscoveryService>(DiscoveryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should cache getPublicAttorneys responses and avoid redundant DB queries within 60s TTL', async () => {
    const query = { page: 1, limit: 10 };

    // First call: hits DB
    const res1 = await service.getPublicAttorneys(query);
    expect(res1.items.length).toBe(1);
    expect(mockPrisma.discoveryIndex.findMany).toHaveBeenCalledTimes(1);

    // Second call: serves from cache, DB not called again
    const res2 = await service.getPublicAttorneys(query);
    expect(res2.items.length).toBe(1);
    expect(mockPrisma.discoveryIndex.findMany).toHaveBeenCalledTimes(1);
  });

  it('should purge cached discovery entries when clearDiscoveryCache is called', async () => {
    const query = { page: 1, limit: 10 };

    await service.getPublicAttorneys(query);
    expect(mockPrisma.discoveryIndex.findMany).toHaveBeenCalledTimes(1);

    // Purge cache
    const purgeRes = service.clearDiscoveryCache('att-1');
    expect(purgeRes.status).toBe('success');

    // Next call should query DB again
    await service.getPublicAttorneys(query);
    expect(mockPrisma.discoveryIndex.findMany).toHaveBeenCalledTimes(2);
  });

  it('should cache getAttorneyDetails and serve from cache', async () => {
    // First call
    const det1 = await service.getAttorneyDetails('att-1');
    expect(det1.attorneyId).toBe('att-1');
    expect(mockPrisma.discoveryIndex.findUnique).toHaveBeenCalledTimes(1);

    // Second call: served from cache
    const det2 = await service.getAttorneyDetails('att-1');
    expect(det2.attorneyId).toBe('att-1');
    expect(mockPrisma.discoveryIndex.findUnique).toHaveBeenCalledTimes(1);

    // Clear cache
    service.clearDiscoveryCache('att-1');
    await service.getAttorneyDetails('att-1');
    expect(mockPrisma.discoveryIndex.findUnique).toHaveBeenCalledTimes(2);
  });
});
