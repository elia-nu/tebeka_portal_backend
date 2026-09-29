import { Test, TestingModule } from '@nestjs/testing';
import { CmsService } from './cms.service';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';

describe('CmsService (FR-WEB Unit Tests)', () => {
  let service: CmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CmsService],
    }).compile();

    service = module.get<CmsService>(CmsService);
  });

  describe('TC-WEB-01: Contact Form Rate Limiting & Auto-Ticket Generation', () => {
    it('should successfully submit contact tickets within rate limits', async () => {
      const clientIp = '196.188.24.10';
      const res = await service.createPublicContact({
        name: 'Solomon Girma',
        email: 'solomon@example.com',
        phone: '+251911223344',
        subject: 'General Legal Inquiry',
        message: 'I would like to inquire about commercial registration requirements.'
      }, clientIp);

      expect(res.status).toBe('success');
      expect(res.ticketNumber).toMatch(/^TCK-\d{6}-\d{4}$/);
      expect(res.ticketId).toBeDefined();
    });

    it('should block 4th contact submission from same IP within 10 minutes (Rate Limit)', async () => {
      const clientIp = '196.188.24.11';
      const payload = {
        name: 'Solomon Girma',
        email: 'solomon@example.com',
        phone: '+251911223344',
        subject: 'Inquiry',
        message: 'This is a test message that exceeds 20 characters in total length.'
      };

      // 3 successful submissions
      await service.createPublicContact(payload, clientIp);
      await service.createPublicContact(payload, clientIp);
      await service.createPublicContact(payload, clientIp);

      // 4th submission must throw 429
      await expect(service.createPublicContact(payload, clientIp))
        .rejects
        .toThrow(HttpException);

      try {
        await service.createPublicContact(payload, clientIp);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.getResponse().code).toBe('CONTACT_FORM_RATE_LIMIT_EXCEEDED');
      }
    });

    it('should validate message length constraints (20-2000 chars)', async () => {
      const clientIp = '196.188.24.12';
      await expect(service.createPublicContact({
        name: 'Short Message',
        email: 'short@example.com',
        message: 'Too short'
      }, clientIp)).rejects.toThrow(BadRequestException);
    });
  });

  describe('TC-WEB-02: Bilingual Completeness Gate (BR-WEB-03 / NFR-LOC-01)', () => {
    it('should reject publishing a page without companion translation', async () => {
      await expect(service.createAdminPage({
        slug: 'new-regulatory-policy',
        locale: 'en',
        title: 'New Policy',
        body: 'English policy content here...',
        status: 'PUBLISHED'
      })).rejects.toThrow(HttpException);

      try {
        await service.createAdminPage({
          slug: 'new-regulatory-policy',
          locale: 'en',
          title: 'New Policy',
          body: 'English policy content here...',
          status: 'PUBLISHED'
        });
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        expect(err.getResponse().code).toBe('BILINGUAL_COMPLETENESS_REQUIRED');
      }
    });

    it('should allow publishing when companion translation is provided', async () => {
      const page = await service.createAdminPage({
        slug: 'new-bilingual-policy',
        locale: 'en',
        title: 'New Policy',
        body: 'English policy content here...',
        status: 'PUBLISHED',
        companionTranslation: true
      });

      expect(page.status).toBe('PUBLISHED');
      expect(page.slug).toBe('new-bilingual-policy');
    });
  });

  describe('Public Trust Metrics Summary (FR-WEB-07)', () => {
    it('should return trust metrics summary with verified attorney count', async () => {
      const res = await service.getPublicStatsSummary();
      expect(res.status).toBe('success');
      expect(res.data.verifiedAttorneysCount).toBeGreaterThan(0);
      expect(res.data.consultationsServed).toBeGreaterThan(0);
      expect(res.data.licensedRegions).toContain('Addis Ababa');
    });
  });
});
