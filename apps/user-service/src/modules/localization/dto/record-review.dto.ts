import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum ReviewDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
}

export class RecordReviewDto {
  @IsString()
  @IsOptional()
  locale?: string;

  @IsString()
  @IsNotEmpty()
  reviewerId: string;

  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @IsString()
  @IsOptional()
  note?: string;
}
