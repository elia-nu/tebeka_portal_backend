import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';

describe('DiscoveryController - purge-cache Endpoint', () => {
  let controller: DiscoveryController;
  let mockDiscoveryService: any;

  beforeEach(async () => {
    mockDiscoveryService = {
      getPublicAttorneys: jest.fn(),
      processQuestionnaire: jest.fn(),
      getAttorneyDetails: jest.fn(),
      clearDiscoveryCache: jest.fn().mockImplementation((attorneyId?: string) => ({
        status: 'success',
        message: attorneyId
          ? `Public discovery cache purged for attorneyId: ${attorneyId}`
          : 'Discovery cache purged successfully',
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscoveryController],
      providers: [
        {
          provide: DiscoveryService,
          useValue: mockDiscoveryService,
        },
      ],
    }).compile();

    controller = module.get<DiscoveryController>(DiscoveryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /discovery/purge-cache with specific attorneyId should invoke clearDiscoveryCache with attorneyId', async () => {
    const result = await controller.purgeDiscoveryCache({ attorneyId: 'att-123' });

    expect(mockDiscoveryService.clearDiscoveryCache).toHaveBeenCalledWith('att-123');
    expect(result.status).toBe('success');
    expect(result.message).toContain('att-123');
  });

  it('POST /discovery/purge-cache without attorneyId should invoke clearDiscoveryCache with undefined to purge all caches', async () => {
    const result = await controller.purgeDiscoveryCache({});

    expect(mockDiscoveryService.clearDiscoveryCache).toHaveBeenCalledWith(undefined);
    expect(result.status).toBe('success');
    expect(result.message).toBe('Discovery cache purged successfully');
  });

  it('POST /discovery/purge-cache with undefined body should safely purge all caches', async () => {
    const result = await controller.purgeDiscoveryCache(undefined as any);

    expect(mockDiscoveryService.clearDiscoveryCache).toHaveBeenCalledWith(undefined);
    expect(result.status).toBe('success');
  });
});
