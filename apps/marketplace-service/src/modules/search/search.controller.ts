import { Controller, Get, Delete, Query, Req, UsePipes } from '@nestjs/common';
import { SearchService } from './search.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { QuerySearchDto, QuerySearchSchema, QuerySearchHistoryDto, QuerySearchHistorySchema } from './dto/query-search.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @AllowAnonymous()
  @Get('attorneys')
  @UsePipes(new JoiValidationPipe(QuerySearchSchema))
  async searchAttorneys(@Query() query: QuerySearchDto, @Req() req: any) {
    const userId = req.user?.id;
    return this.searchService.searchAttorneys(query, userId);
  }

  @Get('history')
  @UsePipes(new JoiValidationPipe(QuerySearchHistorySchema))
  async getSearchHistory(@Query() query: QuerySearchHistoryDto, @Req() req: any) {
    return this.searchService.getSearchHistory(req.user.id, query);
  }

  @Delete('history')
  async clearSearchHistory(@Req() req: any) {
    return this.searchService.clearSearchHistory(req.user.id);
  }
}
