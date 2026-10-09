import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { CONTENT_LIMITS } from '../content.limits.js';

export class UpdateBriefDto {
  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.title)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.angle)
  angle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.audience)
  audience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.objective)
  businessOutcome?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.outline)
  outline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.callToAction)
  callToAction?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  destinationUrl?: string | null;

  @IsOptional()
  @IsArray()
  sources?: Array<{ url: string; note: string; retrievedAt?: string }>;

  @IsOptional()
  @IsArray()
  confirmations?: string[];
}
