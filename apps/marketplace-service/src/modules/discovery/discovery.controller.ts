import { Controller, Get, Post, Body, Param, Query, Req, UsePipes } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import {
  QueryDiscoveryDto,
  QueryDiscoverySchema,
  QuestionnaireDiscoveryDto,
  QuestionnaireDiscoverySchema,
} from './dto/query-discovery.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @AllowAnonymous()
  @Get('attorneys')
  async getPublicAttorneys(
    @Query(new JoiValidationPipe(QueryDiscoverySchema)) query: QueryDiscoveryDto,
    @Req() req: any
  ) {
    const isAnonymous = !req.user;
    return this.discoveryService.getPublicAttorneys(query, isAnonymous);
  }

  @AllowAnonymous()
  @Post('questionnaire')
  async processQuestionnaire(
    @Body(new JoiValidationPipe(QuestionnaireDiscoverySchema)) body: QuestionnaireDiscoveryDto,
    @Req() req: any
  ) {
    const isAnonymous = !req.user;
    return this.discoveryService.processQuestionnaire(body, isAnonymous);
  }

  @AllowAnonymous()
  @Get('attorneys/:id')
  async getAttorneyDetails(@Param('id') id: string) {
    return this.discoveryService.getAttorneyDetails(id);
  }
}
