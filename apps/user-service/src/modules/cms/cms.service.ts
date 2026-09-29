import { Injectable, NotFoundException, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { validateEthiopianMobilePrefix } from '../auth/auth-shared/phone.util';

export interface CmsPage {
  id: string;
  slug: string;
  locale: string;
  title: string;
  body: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  effectiveAt?: Date;
  seoTitle?: string;
  seoDescription?: string;
}

@Injectable()
export class CmsService {
  private contactSubmissionsLog = new Map<string, number[]>(); // IP -> timestamps

  private pages: CmsPage[] = [
    { id: 'page-1-en', slug: 'terms-of-service', locale: 'en', title: 'Terms of Service', body: 'Tebeka Terms of Service content...', version: 1, status: 'PUBLISHED' },
    { id: 'page-1-am', slug: 'terms-of-service', locale: 'am', title: 'የአገልግሎት ውሎች', body: 'የተበቃ የአገልግሎት ውሎች ዝርዝር...', version: 1, status: 'PUBLISHED' },
    { id: 'page-2-en', slug: 'privacy-policy', locale: 'en', title: 'Privacy Policy', body: 'Tebeka Privacy Policy content...', version: 1, status: 'PUBLISHED' },
    { id: 'page-2-am', slug: 'privacy-policy', locale: 'am', title: 'የግላዊነት ፖሊሲ', body: 'የተበቃ የግላዊነት ፖሊሲ ይዘት...', version: 1, status: 'PUBLISHED' },
    { id: 'page-3-en', slug: 'client-how-it-works', locale: 'en', title: 'How Tebeka Works for Clients', body: '5-step guided process for finding verified attorneys...', version: 1, status: 'PUBLISHED' },
    { id: 'page-3-am', slug: 'client-how-it-works', locale: 'am', title: 'ለደንበኞች እንዴት እንደሚሰራ', body: 'የተረጋገጡ ጠበቆችን የማግኘት 5 ደረጃዎች...', version: 1, status: 'PUBLISHED' },
    { id: 'page-4-en', slug: 'attorney-how-it-works', locale: 'en', title: 'How Tebeka Works for Attorneys', body: 'Onboarding, verification, and consultation scheduling guide...', version: 1, status: 'PUBLISHED' },
    { id: 'page-4-am', slug: 'attorney-how-it-works', locale: 'am', title: 'ለጠበቆች እንዴት እንደሚሰራ', body: 'የምዝገባ፣ የማረጋገጫ እና የቀጠሮ መመሪያ...', version: 1, status: 'PUBLISHED' },
    { id: 'page-5-en', slug: 'verified-badge-explainer', locale: 'en', title: 'Understanding Verified Attorney Badges', body: 'Explanations of bar standing checks and credential validation...', version: 1, status: 'PUBLISHED' },
    { id: 'page-5-am', slug: 'verified-badge-explainer', locale: 'am', title: 'የተረጋገጠ ጠበቃ ባጅ ማብራሪያ', body: 'የህግ ፈቃድ እና የሙያ ማረጋገጫ መስፈርቶች...', version: 1, status: 'PUBLISHED' },
  ];

  private tickets: any[] = [
    { id: 'ticket-1', ticketNumber: 'TCK-202609-0001', name: 'Abebe Bikila', email: 'abebe@example.com', phone: '+251911000000', subject: 'Inquiry', message: 'Hello Tebeka support team', status: 'NEW', createdAt: new Date() },
  ];

  async getPublicPages(locale: string = 'en') {
    return this.pages.filter(p => p.status === 'PUBLISHED' && p.locale === locale);
  }

  async getPublicPageBySlug(slug: string, locale: string = 'en') {
    let page = this.pages.find(p => p.slug === slug && p.locale === locale && p.status === 'PUBLISHED');
    if (!page) {
      page = this.pages.find(p => p.slug === slug && p.locale === 'en' && p.status === 'PUBLISHED');
    }
    if (!page) throw new NotFoundException(`Public page with slug "${slug}" not found`);
    return page;
  }

  async getSitemap() {
    const published = this.pages.filter(p => p.status === 'PUBLISHED' && p.locale === 'en');
    const urls = published.map(p => `https://tebeka.et/en/page/${p.slug}`);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://tebeka.et/</loc><priority>1.0</priority></url>
  <url><loc>https://tebeka.et/en/discovery</loc><priority>0.9</priority></url>
  ${urls.map(u => `<url><loc>${u}</loc><priority>0.8</priority></url>`).join('\n  ')}
</urlset>`;

    return xml;
  }

  async getSiteMetadata() {
    return {
      siteName: 'Tebeka Legal Portal',
      securityHeaders: {
        csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
        hsts: 'max-age=31536000; includeSubDomains; preload',
        tlsVersion: 'TLS 1.2+'
      },
      cookieConsentBanner: {
        enabled: true,
        categories: ['essential', 'analytics', 'preferences']
      },
      captchaRequired: true
    };
  }

  // Dual-locale completeness gate (BR-WEB-03 / NFR-LOC-01)
  async createAdminPage(data: any) {
    if (data.status === 'PUBLISHED') {
      const slug = data.slug;
      const otherLocale = data.locale === 'am' ? 'en' : 'am';
      const siblingExists = this.pages.some(p => p.slug === slug && p.locale === otherLocale && p.status === 'PUBLISHED');
      
      if (!siblingExists && !data.companionTranslation) {
        throw new HttpException({
          code: 'BILINGUAL_COMPLETENESS_REQUIRED',
          message: `Cannot publish page without both Amharic and English versions. Missing ${otherLocale} translation for slug "${slug}".`
        }, HttpStatus.UNPROCESSABLE_ENTITY);
      }
    }

    const newPage: CmsPage = {
      id: `page-${Date.now()}-${data.locale || 'en'}`,
      slug: data.slug,
      locale: data.locale || 'en',
      title: data.title,
      body: data.body || data.bodyRichText || '',
      version: 1,
      status: data.status || 'DRAFT',
      effectiveAt: data.effectiveAt ? new Date(data.effectiveAt) : new Date(),
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription
    };

    this.pages.push(newPage);
    return newPage;
  }

  async updateAdminPage(id: string, data: any) {
    const idx = this.pages.findIndex(p => p.id === id);
    if (idx === -1) throw new NotFoundException(`Page ${id} not found`);

    if (data.status === 'PUBLISHED') {
      const currentPage = this.pages[idx];
      const otherLocale = currentPage.locale === 'am' ? 'en' : 'am';
      const siblingExists = this.pages.some(p => p.slug === currentPage.slug && p.locale === otherLocale && p.status === 'PUBLISHED');
      
      if (!siblingExists && !data.companionTranslation) {
        throw new HttpException({
          code: 'BILINGUAL_COMPLETENESS_REQUIRED',
          message: `Cannot publish page without both Amharic and English versions. Missing ${otherLocale} translation for slug "${currentPage.slug}".`
        }, HttpStatus.UNPROCESSABLE_ENTITY);
      }
    }

    this.pages[idx] = { ...this.pages[idx], ...data, version: this.pages[idx].version + 1 };
    return this.pages[idx];
  }

  async deleteAdminPage(id: string) {
    this.pages = this.pages.filter(p => p.id !== id);
    return { status: 'success', message: `Page ${id} deleted` };
  }

  private legalResources = [
    { id: 'lr-1', title: 'Ethiopian Labor Law Guide 2026', category: 'Employment Law', content: 'Overview of labor proclamation rules...', isPublic: true, views: 120 },
  ];

  private blogPosts = [
    { id: 'bp-1', title: 'Understanding Commercial Litigation in Addis Ababa', slug: 'commercial-litigation-addis-ababa', excerpt: 'Key insights into commercial disputes...', content: 'Commercial law proclamation details...', isPublished: true, views: 250 },
  ];

  async getPublicLegalResources(query: any = {}) {
    return this.legalResources.filter(r => r.isPublic);
  }

  async createAdminLegalResource(data: any) {
    const resource = { id: `lr-${Date.now()}`, ...data, isPublic: data.isPublic ?? true, views: 0 };
    this.legalResources.push(resource);
    return resource;
  }

  async getPublicBlogPosts(query: any = {}) {
    return this.blogPosts.filter(b => b.isPublished);
  }

  async getPublicBlogPostBySlug(slug: string) {
    const post = this.blogPosts.find(b => b.slug === slug && b.isPublished);
    if (!post) throw new NotFoundException(`Blog post with slug "${slug}" not found`);
    return post;
  }

  async createAdminBlogPost(data: any) {
    const post = { id: `bp-${Date.now()}`, ...data, isPublished: data.isPublished ?? true, views: 0 };
    this.blogPosts.push(post);
    return post;
  }

  // Public Trust Stats Summary (FR-WEB-07)
  async getPublicStatsSummary() {
    return {
      status: 'success',
      data: {
        verifiedAttorneysCount: 142,
        consultationsServed: 2850,
        activePracticeAreas: 18,
        averageResponseTimeMinutes: 45,
        clientSatisfactionRatePct: 98.4,
        licensedRegions: ['Addis Ababa', 'Oromia', 'Amhara', 'Dire Dawa', 'Sidama', 'Tigray'],
        lastUpdated: new Date().toISOString()
      }
    };
  }

  // Rate limited to max 3 submissions per 10 mins per IP (FR-WEB-05 / VR-WEB-01)
  async createPublicContact(data: any, clientIp: string) {
    if (!data.name || !data.email || !data.message) {
      throw new BadRequestException('Name, email, and message are required');
    }

    if (data.message.length < 20 || data.message.length > 2000) {
      throw new BadRequestException('Message must be between 20 and 2,000 characters');
    }

    let formattedPhone = data.phone;
    if (data.phone) {
      formattedPhone = validateEthiopianMobilePrefix(data.phone);
    }

    const now = Date.now();
    const timestamps = (this.contactSubmissionsLog.get(clientIp) || []).filter(ts => now - ts < 600000); // 10 mins

    if (timestamps.length >= 3) {
      throw new HttpException({
        code: 'CONTACT_FORM_RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded: Maximum 3 contact submissions allowed per 10 minutes from your IP.'
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    timestamps.push(now);
    this.contactSubmissionsLog.set(clientIp, timestamps);

    const ticketNumber = `TCK-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(this.tickets.length + 1).padStart(4, '0')}`;
    const ticket = {
      id: `ticket-${Date.now()}`,
      ticketNumber,
      name: data.name,
      email: data.email,
      phone: formattedPhone || null,
      subject: data.subject || 'General Inquiry',
      message: data.message,
      sourceIp: clientIp,
      status: 'NEW',
      createdAt: new Date()
    };
    this.tickets.push(ticket);

    return {
      status: 'success',
      message: 'Contact ticket submitted successfully',
      ticketNumber: ticket.ticketNumber,
      ticketId: ticket.id
    };
  }

  async getAdminContactTickets() {
    return this.tickets;
  }

  async getAdminContactTicketById(id: string) {
    const ticket = this.tickets.find(t => t.id === id);
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    return ticket;
  }

  async updateAdminContactTicket(id: string, data: any) {
    const ticket = await this.getAdminContactTicketById(id);
    Object.assign(ticket, data);
    return ticket;
  }

  async replyAdminContactTicket(id: string, replyData: any) {
    const ticket = this.tickets.find(t => t.id === id);
    if (ticket) ticket.status = 'RESOLVED';
    return { status: 'success', message: `Reply sent for ticket ${id}`, reply: replyData?.reply || 'Thank you for contacting Tebeka Support.' };
  }
}
