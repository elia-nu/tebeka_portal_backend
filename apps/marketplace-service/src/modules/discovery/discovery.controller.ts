import { Controller, Get, Post, Body, Param, Query, Req, UsePipes, UseGuards } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { JwtAuthGuard, RolesGuard, Public } from '@workspace/auth';
import {
  QueryDiscoveryDto,
  QueryDiscoverySchema,
  QuestionnaireDiscoveryDto,
  QuestionnaireDiscoverySchema,
} from './dto/query-discovery.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Public()
  @Get('attorneys')
  async getPublicAttorneys(
    @Query(new JoiValidationPipe(QueryDiscoverySchema)) query: QueryDiscoveryDto,
    @Req() req: any
  ) {
    const isAnonymous = !req.user;
    return this.discoveryService.getPublicAttorneys(query, isAnonymous);
  }

  @Public()
  @Post('questionnaire')
  async processQuestionnaire(
    @Body(new JoiValidationPipe(QuestionnaireDiscoverySchema)) body: QuestionnaireDiscoveryDto,
    @Req() req: any
  ) {
    const isAnonymous = !req.user;
    return this.discoveryService.processQuestionnaire(body, isAnonymous);
  }

  @Public()
  @Get('attorneys/:id')
  async getAttorneyDetails(@Param('id') id: string) {
    return this.discoveryService.getAttorneyDetails(id);
  }
}
