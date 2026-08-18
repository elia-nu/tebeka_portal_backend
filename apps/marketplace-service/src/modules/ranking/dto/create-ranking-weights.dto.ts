import * as Joi from 'joi';

export interface CreateRankingWeightsDto {
  verificationWeight: number;
  ratingWeight: number;
  experienceWeight: number;
  responsivenessWeight: number;
}

export const CreateRankingWeightsSchema = Joi.object({
  verificationWeight: Joi.number().min(0).max(100).required(),
  ratingWeight: Joi.number().min(0).max(100).required(),
  experienceWeight: Joi.number().min(0).max(100).required(),
  responsivenessWeight: Joi.number().min(0).max(100).required(),
}).custom((value, helpers) => {
  const sum = value.verificationWeight + value.ratingWeight + value.experienceWeight + value.responsivenessWeight;
  if (sum !== 100) {
    return helpers.message({ custom: 'Total sum of weights (verification, rating, experience, responsiveness) must equal exactly 100%' });
  }
  return value;
});
