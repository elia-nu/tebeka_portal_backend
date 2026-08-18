import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class CmsService {
  private contactSubmissionsLog = new Map<string, number[]>(); // IP -> timestamps

  private pages = [
    { id: 'page-1', slug: 'terms-of-service', locale: 'en', title: 'Terms of Service', body: 'Tebeka Terms of Service content...', version: 1, status: 'PUBLISHED' },
    { id: 'page-2', slug: 'privacy-policy', locale: 'en', title: 'Privacy Policy', body: 'Tebeka Privacy Policy content...', version: 1, status: 'PUBLISHED' },
    { id: 'page-3', slug: 'client-how-it-works', locale: 'en', title: 'How Tebeka Works for Clients', body: '5-step guided process for finding verified attorneys...', version: 1, status: 'PUBLISHED' },
    { id: 'page-4', slug: 'attorney-how-it-works', locale: 'en', title: 'How Tebeka Works for Attorneys', body: 'Onboarding, verification, and consultation scheduling guide...', version: 1, status: 'PUBLISHED' },
    { id: 'page-5', slug: 'verified-badge-explainer', locale: 'en', title: 'Understanding Verified Attorney Badges', body: 'Explanations of bar standing checks and credential validation...', version: 1, status: 'PUBLISHED' },
  ];

  private tickets = [
    { id: 'ticket-1', name: 'Abebe Bikila', email: 'abebe@example.com', phone: '+251911000000', subject: 'Inquiry', message: 'Hello Tebeka support', status: 'OPEN', createdAt: new Date() },
  ];

  async getPublicPages() {
    return this.pages.filter(p => p.status === 'PUBLISHED');
  }

  async getPublicPageBySlug(slug: string) {
    const page = this.pages.find(p => p.slug === slug);
    if (!page) throw new NotFoundException(`Public page with slug ${slug} not found`);
    return page;
  }

  async getSitemap() {
    const published = this.pages.filter(p => p.status === 'PUBLISHED');
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

  async createAdminPage(data: any) {
    const newPage = { id: `page-${Date.now()}`, ...data, version: 1, status: data.status || 'DRAFT' };
    this.pages.push(newPage);
    return newPage;
  }

  async updateAdminPage(id: string, data: any) {
    const idx = this.pages.findIndex(p => p.id === id);
    if (idx === -1) throw new NotFoundException(`Page ${id} not found`);
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

  // Rate limited to max 3 submissions per 10 mins per IP
  async createPublicContact(data: any, clientIp: string) {
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

    const ticket = { id: `ticket-${Date.now()}`, ...data, status: 'OPEN', createdAt: new Date() };
    this.tickets.push(ticket);

    return { status: 'success', message: 'Contact ticket submitted successfully', ticketId: ticket.id };
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
