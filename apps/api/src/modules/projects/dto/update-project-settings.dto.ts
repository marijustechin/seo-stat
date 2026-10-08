import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { MAX_COMPETITOR_URLS } from '../competitor-urls.js';
import { PUBLISHING_POLICIES, type PublishingPolicy } from '../project.types.js';

/** Business context, content rules, and publishing policy. */
export class UpdateProjectSettingsDto {
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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_COMPETITOR_URLS)
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] }, { each: true })
  competitorUrls?: string[];
}
