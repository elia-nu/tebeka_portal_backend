import { Controller, Get, Post, Body, Req, UsePipes, UseGuards } from '@nestjs/common';
import { RankingService } from './ranking.service';
import { JwtAuthGuard, RolesGuard, Roles, Public } from '@workspace/auth';
import { CreateRankingWeightsDto, CreateRankingWeightsSchema } from './dto/create-ranking-weights.dto';
import { JoiValidationPipe } from '../../common/pipes/joi-validation.pipe';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Public()
  @Get('weights')
  async getActiveWeights() {
    return this.rankingService.getActiveWeights();
  }

  @Post('weights')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UsePipes(new JoiValidationPipe(CreateRankingWeightsSchema))
  async createWeights(@Body() body: CreateRankingWeightsDto, @Req() req: any) {
    return this.rankingService.createWeights(body, req.user.id);
  }
}
