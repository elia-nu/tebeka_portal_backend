import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('users')
  async searchUsers(@Query() query: any) {
    return this.searchService.searchUsers(query);
  }

  @Get('attorneys')
  async searchAttorneys(@Query() query: any) {
    return this.searchService.searchAttorneys(query);
  }

  @AllowAnonymous()
  @Get('practice-areas')
  async searchPracticeAreas(@Query() query: any) {
    return this.searchService.searchPracticeAreas(query);
  }
}
