import { IsIn, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';
import { PUBLISHING_POLICIES, type PublishingPolicy } from '../project.types.js';

export class CreateProjectDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  websiteUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  businessContext?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  audience?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  objectives?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 35)
  contentLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsIn(PUBLISHING_POLICIES)
  publishingPolicy?: PublishingPolicy;
}
