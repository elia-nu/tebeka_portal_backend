import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { PrismaService } from '@workspace/database';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard, RolesGuard } from '@workspace/auth';

describe('Search & Practice Areas Public Endpoints (E2E / Integration)', () => {
  let app: INestApplication;
  let mockPrisma: any;

  beforeAll(async () => {
    mockPrisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      attorneyProfile: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      practiceArea: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'e319024a-5512-4c02-9912-1049281a8b12',
            key: 'corporate-law',
            nameEn: 'Corporate Law',
            nameAm: 'የንግድ ሕግ',
            descriptionEn: 'Business formation and corporate litigation',
            descriptionAm: 'የንግድ ምዝገባ እና ክርክሮች',
            icon: 'briefcase',
            sortOrder: 1,
            isActive: true,
          },
          {
            id: 'f420135b-6623-4d03-8823-2059392b9c23',
            key: 'family-law',
            nameEn: 'Family Law',
            nameAm: 'የቤተሰብ ሕግ',
            descriptionEn: 'Divorce and child custody',
            descriptionAm: 'የፍቺ እና የልጆች አስተዳደግ',
            icon: 'heart',
            sortOrder: 2,
            isActive: true,
          },
        ]),
        findFirst: jest.fn().mockImplementation(({ where }: any) => {
          const idOrKey = where.OR[0].id;
          if (idOrKey === 'e319024a-5512-4c02-9912-1049281a8b12' || idOrKey === 'corporate-law') {
            return Promise.resolve({
              id: 'e319024a-5512-4c02-9912-1049281a8b12',
              key: 'corporate-law',
              nameEn: 'Corporate Law',
              nameAm: 'የንግድ ሕግ',
              descriptionEn: 'Business formation and corporate litigation',
              isActive: true,
            });
          }
          return Promise.resolve(null);
        }),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        SearchService,
        { provide: PrismaService, useValue: mockPrisma },
        Reflector,
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/search/practice-areas should return 200 OK without authentication', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/search/practice-areas')
      .expect(200);

    expect(res.body.count).toBe(2);
    expect(res.body.results.length).toBe(2);
    expect(res.body.results[0].nameEn).toBe('Corporate Law');
    expect(res.body.results[0].nameAm).toBe('የንግድ ሕግ');
  });

  it('GET /api/v1/practice-areas should return 200 OK without authentication', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/practice-areas')
      .expect(200);

    expect(res.body.count).toBe(2);
    expect(res.body.results[1].nameEn).toBe('Family Law');
  });

  it('GET /api/v1/public/practice-areas should return 200 OK without authentication', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/practice-areas')
      .expect(200);

    expect(res.body.count).toBe(2);
  });

  it('GET /api/v1/practice-areas/:id should return single practice area without auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/practice-areas/e319024a-5512-4c02-9912-1049281a8b12')
      .expect(200);

    expect(res.body.id).toBe('e319024a-5512-4c02-9912-1049281a8b12');
    expect(res.body.key).toBe('corporate-law');
  });

  it('GET /api/v1/practice-areas/:id with non-existent id should return 404', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/practice-areas/non-existent-id')
      .expect(404);
  });
});
