import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateUpdateStringDto {
  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsOptional()
  namespace?: string;

  @IsString()
  @IsOptional()
  locale?: string;

  @IsBoolean()
  @IsOptional()
  legalSensitive?: boolean;
}
