import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CONTENT_LIMITS } from '../content.limits.js';

export class CreateKnowledgeDto {
  @IsString()
  @MaxLength(CONTENT_LIMITS.knowledgeText)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.requirementQuestion)
  originQuestion?: string | null;

  @IsOptional()
  @IsString()
  originTopicId?: string | null;
}

export class UpdateKnowledgeDto {
  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.knowledgeText)
  text?: string;
}
