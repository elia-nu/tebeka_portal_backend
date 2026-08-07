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
    const ticket = await this.getAdminContactTicketById(id);
    ticket.status = 'RESOLVED';
    return { status: 'success', message: `Reply sent for ticket ${id}`, reply: replyData.reply };
  }
}
