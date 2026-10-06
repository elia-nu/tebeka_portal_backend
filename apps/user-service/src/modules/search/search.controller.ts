import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('search/users')
  async searchUsers(@Query() query: any) {
    return this.searchService.searchUsers(query);
  }

  @Get('search/attorneys')
  async searchAttorneys(@Query() query: any) {
    return this.searchService.searchAttorneys(query);
  }

  @AllowAnonymous()
  @Get('search/practice-areas')
  async searchPracticeAreas(@Query() query: any) {
    return this.searchService.searchPracticeAreas(query);
  }

  @AllowAnonymous()
  @Get('practice-areas')
  async getPracticeAreas(@Query() query: any) {
    return this.searchService.searchPracticeAreas(query);
  }

  @AllowAnonymous()
  @Get('public/practice-areas')
  async getPublicPracticeAreas(@Query() query: any) {
    return this.searchService.searchPracticeAreas(query);
  }
}
