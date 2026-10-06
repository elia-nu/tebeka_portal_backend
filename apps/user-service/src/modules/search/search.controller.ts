import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { Public } from '@workspace/auth';

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

  @Public()
  @Get('search/practice-areas')
  async searchPracticeAreas(@Query() query: any) {
    return this.searchService.searchPracticeAreas(query);
  }

  @Public()
  @Get('search/practice-areas/:id')
  async searchPracticeAreaById(@Param('id') id: string) {
    return this.searchService.getPracticeAreaById(id);
  }

  @Public()
  @Get('practice-areas')
  async getPracticeAreas(@Query() query: any) {
    return this.searchService.searchPracticeAreas(query);
  }

  @Public()
  @Get('practice-areas/:id')
  async getPracticeAreaById(@Param('id') id: string) {
    return this.searchService.getPracticeAreaById(id);
  }

  @Public()
  @Get('public/practice-areas')
  async getPublicPracticeAreas(@Query() query: any) {
    return this.searchService.searchPracticeAreas(query);
  }

  @Public()
  @Get('public/practice-areas/:id')
  async getPublicPracticeAreaById(@Param('id') id: string) {
    return this.searchService.getPracticeAreaById(id);
  }
}
