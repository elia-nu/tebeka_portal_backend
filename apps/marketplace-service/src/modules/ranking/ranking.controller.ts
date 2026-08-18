import { Controller, Get, Post, Body, Req, UsePipes } from '@nestjs/common';
import { RankingService } from './ranking.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { CreateRankingWeightsDto, CreateRankingWeightsSchema } from './dto/create-ranking-weights.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @AllowAnonymous()
  @Get('weights')
  async getActiveWeights() {
    return this.rankingService.getActiveWeights();
  }

  @Post('weights')
  @UsePipes(new JoiValidationPipe(CreateRankingWeightsSchema))
  async createWeights(@Body() body: CreateRankingWeightsDto, @Req() req: any) {
    return this.rankingService.createWeights(body, req.user?.id || 'admin');
  }
}
