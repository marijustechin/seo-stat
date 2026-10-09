import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { CONTENT_LIMITS } from '../content.limits.js';

export class UpdateDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.title)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.excerpt)
  excerpt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.bodyMarkdown)
  bodyMarkdown?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.slug)
  slug?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.seoTitle)
  seoTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.metaDescription)
  metaDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_LIMITS.callToAction)
  callToAction?: string | null;

  @IsOptional()
  @IsArray()
  unresolvedClaims?: string[];

  /** Optimistic concurrency: the draft's updatedAt the client last saw. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  expectedUpdatedAt?: string;
}
