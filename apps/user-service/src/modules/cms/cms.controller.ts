import { Controller, Get, Post, Patch, Delete, Body, Param, Req, Header } from '@nestjs/common';
import { CmsService } from './cms.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller()
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @AllowAnonymous()
  @Get('public/pages')
  async getPublicPages() {
    return this.cmsService.getPublicPages();
  }

  @AllowAnonymous()
  @Get('public/pages/:slug')
  async getPublicPageBySlug(@Param('slug') slug: string) {
    return this.cmsService.getPublicPageBySlug(slug);
  }

  @AllowAnonymous()
  @Header('Content-Type', 'text/xml')
  @Get('public/sitemap.xml')
  async getSitemap() {
    return this.cmsService.getSitemap();
  }

  @AllowAnonymous()
  @Get('public/site-metadata')
  async getSiteMetadata() {
    return this.cmsService.getSiteMetadata();
  }

  @Post('admin/pages')
  async createAdminPage(@Body() body: any) {
    return this.cmsService.createAdminPage(body);
  }

  @Patch('admin/pages/:id')
  async updateAdminPage(@Param('id') id: string, @Body() body: any) {
    return this.cmsService.updateAdminPage(id, body);
  }

  @Delete('admin/pages/:id')
  async deleteAdminPage(@Param('id') id: string) {
    return this.cmsService.deleteAdminPage(id);
  }

  @AllowAnonymous()
  @Get('public/legal-resources')
  async getPublicLegalResources() {
    return this.cmsService.getPublicLegalResources();
  }

  @Post('admin/legal-resources')
  async createAdminLegalResource(@Body() body: any) {
    return this.cmsService.createAdminLegalResource(body);
  }

  @AllowAnonymous()
  @Get('public/blog-posts')
  async getPublicBlogPosts() {
    return this.cmsService.getPublicBlogPosts();
  }

  @AllowAnonymous()
  @Get('public/blog-posts/:slug')
  async getPublicBlogPostBySlug(@Param('slug') slug: string) {
    return this.cmsService.getPublicBlogPostBySlug(slug);
  }

  @Post('admin/blog-posts')
  async createAdminBlogPost(@Body() body: any) {
    return this.cmsService.createAdminBlogPost(body);
  }

  @AllowAnonymous()
  @Post('public/contact')
  async createPublicContact(@Body() body: any, @Req() req: any) {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    return this.cmsService.createPublicContact(body, clientIp);
  }

  @Get('admin/contact')
  async getAdminContactTickets() {
    return this.cmsService.getAdminContactTickets();
  }

  @Get('admin/contact/:id')
  async getAdminContactTicketById(@Param('id') id: string) {
    return this.cmsService.getAdminContactTicketById(id);
  }

  @Patch('admin/contact/:id')
  async updateAdminContactTicket(@Param('id') id: string, @Body() body: any) {
    return this.cmsService.updateAdminContactTicket(id, body);
  }

  @Post('admin/contact/:id/reply')
  async replyAdminContactTicket(@Param('id') id: string, @Body() body: any) {
    return this.cmsService.replyAdminContactTicket(id, body);
  }
}
