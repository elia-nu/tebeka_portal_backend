import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/marketplace';

const prisma = new PrismaClient();

@Injectable()
export class RankingService {
  async getActiveWeights() {
    const latestWeight = await prisma.rankingWeight.findFirst({
      orderBy: { effectiveAt: 'desc' },
    });

    if (!latestWeight) {
      return {
        verificationWeight: 30,
        ratingWeight: 25,
        experienceWeight: 25,
        responsivenessWeight: 20,
      };
    }

    return latestWeight;
  }

  async createWeights(data: any, adminId: string) {
    const total =
      Number(data.verificationWeight || 0) +
      Number(data.ratingWeight || 0) +
      Number(data.experienceWeight || 0) +
      Number(data.responsivenessWeight || 0);

    if (total !== 100) {
      throw new BadRequestException('Ranking weights must total exactly 100%');
    }

    // Interactive Transaction: Weight creation and index score recalculation inside tx
    return prisma.$transaction(async (tx) => {
      const createdWeights = await tx.rankingWeight.create({
        data: {
          verificationWeight: data.verificationWeight,
          ratingWeight: data.ratingWeight,
          experienceWeight: data.experienceWeight,
          responsivenessWeight: data.responsivenessWeight,
          approvedBy1: adminId,
        },
      });

      // Recalculate searchScore across all DiscoveryIndex entries
      const discoveryItems = await tx.discoveryIndex.findMany();
      for (const item of discoveryItems) {
        const newScore = this.calculateScore(item, data);
        await tx.discoveryIndex.update({
          where: { attorneyId: item.attorneyId },
          data: { searchScore: newScore },
        });
      }

      return createdWeights;
    });
  }

  calculateScore(
    discoveryItem: { rating: number; responsivenessScore: number; experienceScore: number; verifiedAt: any },
    weights: { verificationWeight: number; ratingWeight: number; experienceWeight: number; responsivenessWeight: number }
  ): number {
    const verificationPart = discoveryItem.verifiedAt ? 100 : 50;
    const ratingPart = (discoveryItem.rating / 5) * 100;
    const responsivenessPart = Math.min(100, discoveryItem.responsivenessScore);
    const experiencePart = Math.min(100, discoveryItem.experienceScore);

    const score =
      (verificationPart * weights.verificationWeight +
        ratingPart * weights.ratingWeight +
        responsivenessPart * weights.responsivenessWeight +
        experiencePart * weights.experienceWeight) /
      100;

    return Number(score.toFixed(2));
  }
}
