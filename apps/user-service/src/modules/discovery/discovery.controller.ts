import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { DiscoveryService, QuestionnaireInput } from './discovery.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @AllowAnonymous()
  @Get('attorneys')
  async getPublicAttorneys(@Query() query: any, @Req() req: any) {
    const isAnonymous = !req.user;
    return this.discoveryService.getPublicAttorneys(query, isAnonymous);
  }

  @AllowAnonymous()
  @Post('questionnaire')
  async processQuestionnaire(@Body() body: QuestionnaireInput, @Req() req: any) {
    const isAnonymous = !req.user;
    return this.discoveryService.processQuestionnaire(body, isAnonymous);
  }

  @AllowAnonymous()
  @Get('ranking-explanation')
  async getRankingExplanation() {
    return this.discoveryService.getRankingExplanation();
  }

  @AllowAnonymous()
  @Get('attorneys/search')
  async searchPublicAttorneys(@Query() query: any, @Req() req: any) {
    const isAnonymous = !req.user;
    return this.discoveryService.getPublicAttorneys(query, isAnonymous);
  }

  @AllowAnonymous()
  @Get('attorneys/:slug')
  async getPublicAttorneyBySlug(@Param('slug') slug: string) {
    return this.discoveryService.getPublicAttorneyBySlug(slug);
  }

  @AllowAnonymous()
  @Get('search-index')
  async getSearchIndexProjection() {
    return this.discoveryService.getSearchIndexProjection();
  }
}
