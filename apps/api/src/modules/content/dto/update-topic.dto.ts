import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CONTENT_LIMITS } from '../content.limits.js';
import { TOPIC_PRIORITIES } from '../content.types.js';

export class UpdateTopicDto {
  @IsOptional()
  @IsString()
  @Length(1, CONTENT_LIMITS.title)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, CONTENT_LIMITS.audience)
  audience?: string;

  @IsOptional()
  @IsString()
  @Length(1, CONTENT_LIMITS.objective)
  objective?: string;

  @IsOptional()
  @IsString()
  @Length(1, CONTENT_LIMITS.angle)
  angle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.readerNeed)
  readerNeed?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.callToAction)
  callToAction?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.relevance)
  relevance?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.informationNeeded)
  informationNeeded?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.objectiveAlignment)
  objectiveAlignment?: string | null;

  @IsOptional()
  @IsIn(TOPIC_PRIORITIES)
  priority?: 'primary' | 'secondary' | 'supporting';
}
