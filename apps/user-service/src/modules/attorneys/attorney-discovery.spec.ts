import { QueryAttorneySchema } from './dto/attorney.dto';
import { AttorneyProfileService } from './services/attorney-profile.service';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

describe('High-Scale Attorney Discovery & Dynamic Sorting', () => {
  describe('QueryAttorneySchema & JoiValidationPipe', () => {
    const pipe = new JoiValidationPipe(QueryAttorneySchema);

    it('should NOT strip discovery search, filter, and sort parameters', () => {
      const rawQuery = {
        q: 'Abebe',
        practiceArea: 'commercial-law',
        feeBand: 'BAND_B',
        city: 'Addis Ababa',
        subcity: 'Bole',
        region: 'Addis Ababa',
        language: 'am',
        minRating: 4.5,
        sortBy: 'rating',
        sortOrder: 'desc',
        page: 2,
        limit: 15,
      };

      const validated = pipe.transform(rawQuery, { type: 'query' });

      expect(validated.q).toBe('Abebe');
      expect(validated.practiceArea).toBe('commercial-law');
      expect(validated.feeBand).toBe('BAND_B');
      expect(validated.city).toBe('Addis Ababa');
      expect(validated.subcity).toBe('Bole');
      expect(validated.region).toBe('Addis Ababa');
      expect(validated.language).toBe('am');
      expect(validated.minRating).toBe(4.5);
      expect(validated.sortBy).toBe('rating');
      expect(validated.sortOrder).toBe('desc');
      expect(validated.page).toBe(2);
      expect(validated.limit).toBe(15);
    });

    it('should assign default values for pagination and sorting in QueryAttorneySchema', () => {
      const { value: validated } = QueryAttorneySchema.validate({});

      expect(validated.page).toBe(1);
      expect(validated.limit).toBe(20);
      expect(validated.sortBy).toBe('createdAt');
      expect(validated.sortOrder).toBe('desc');
    });

    it('should populate defaults for omitted fields through JoiValidationPipe', () => {
      const validated = pipe.transform({ q: 'test' }, { type: 'query' });

      expect(validated.q).toBe('test');
      expect(validated.page).toBe(1);
      expect(validated.limit).toBe(20);
      expect(validated.sortBy).toBe('createdAt');
      expect(validated.sortOrder).toBe('desc');
    });

    it('should enforce limit bounds (max 50)', () => {
      expect(() => {
        pipe.transform({ limit: 100 }, { type: 'query' });
      }).toThrow();
    });

    it('should validate allowed sort keys', () => {
      expect(() => {
        pipe.transform({ sortBy: 'unknownField' }, { type: 'query' });
      }).toThrow();
    });
  });

  describe('AttorneyProfileService.findAll()', () => {
    let service: AttorneyProfileService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        attorneyProfile: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'attorney-1',
              fullName: 'Abebe Bikila',
              rating: 4.9,
              feeBand: 'BAND_B',
              practiceAreas: ['commercial-law'],
              languages: ['am', 'en'],
              user: { id: 'user-1', name: 'Abebe Bikila', passwordHash: 'secret' },
              educations: [],
              credentials: [],
            },
          ]),
          count: jest.fn().mockResolvedValue(1),
        },
      };

      service = new AttorneyProfileService(mockPrisma as any);
    });

    it('should search keyword across fullName, bio, lawFirmName, user.name with case-insensitive matching', async () => {
      await service.findAll({ q: 'Abebe' });

      expect(mockPrisma.attorneyProfile.findMany).toHaveBeenCalled();
      const findArgs = mockPrisma.attorneyProfile.findMany.mock.calls[0][0];

      expect(findArgs.where.OR).toBeDefined();
      expect(findArgs.where.OR).toEqual(
        expect.arrayContaining([
          { fullName: { contains: 'Abebe', mode: 'insensitive' } },
          { lawFirmName: { contains: 'Abebe', mode: 'insensitive' } },
          { user: { name: { contains: 'Abebe', mode: 'insensitive' } } },
        ])
      );
    });

    it('should apply specialty array containment filter using Prisma has operator', async () => {
      await service.findAll({ practiceArea: 'commercial-law' });

      const findArgs = mockPrisma.attorneyProfile.findMany.mock.calls[0][0];
      expect(findArgs.where.practiceAreas).toEqual({ has: 'commercial-law' });
    });

    it('should apply feeBand, minRating, and language filters', async () => {
      await service.findAll({
        feeBand: 'BAND_B',
        language: 'am',
        minRating: 4.5,
      });

      const findArgs = mockPrisma.attorneyProfile.findMany.mock.calls[0][0];
      expect(findArgs.where.feeBand).toBe('BAND_B');
      expect(findArgs.where.languages).toEqual({ has: 'am' });
      expect(findArgs.where.rating).toEqual({ gte: 4.5 });
    });

    it('should dynamically sort by rating in descending order', async () => {
      await service.findAll({ sortBy: 'rating', sortOrder: 'desc' });

      const findArgs = mockPrisma.attorneyProfile.findMany.mock.calls[0][0];
      expect(findArgs.orderBy).toEqual({ rating: 'desc' });
    });

    it('should dynamically sort by consultationFee in ascending order', async () => {
      await service.findAll({ sortBy: 'consultationFee', sortOrder: 'asc' });

      const findArgs = mockPrisma.attorneyProfile.findMany.mock.calls[0][0];
      expect(findArgs.orderBy).toEqual({ consultationFee: 'asc' });
    });

    it('should dynamically sort by experienceYears in descending order', async () => {
      await service.findAll({ sortBy: 'experienceYears', sortOrder: 'desc' });

      const findArgs = mockPrisma.attorneyProfile.findMany.mock.calls[0][0];
      expect(findArgs.orderBy).toEqual({ experienceYears: 'desc' });
    });

    it('should sanitize sensitive user fields from output', async () => {
      const result = await service.findAll();

      expect(result.items).toBeDefined();
      expect(result.items[0].user.passwordHash).toBeUndefined();
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should ignore ALL as location filter values', async () => {
      await service.findAll({
        city: 'ALL',
        subcity: 'ALL',
        region: 'ALL',
        practiceArea: 'ALL',
        feeBand: 'ALL',
        language: 'ALL',
      });

      const findArgs = mockPrisma.attorneyProfile.findMany.mock.calls[0][0];
      expect(findArgs.where.city).toBeUndefined();
      expect(findArgs.where.subcity).toBeUndefined();
      expect(findArgs.where.region).toBeUndefined();
      expect(findArgs.where.practiceAreas).toBeUndefined();
      expect(findArgs.where.feeBand).toBeUndefined();
      expect(findArgs.where.languages).toBeUndefined();
    });
  });
});
