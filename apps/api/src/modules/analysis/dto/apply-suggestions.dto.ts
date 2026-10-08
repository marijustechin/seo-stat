import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplySuggestionsDto {
  @IsOptional()
  @IsBoolean()
  acknowledgeConflict?: boolean;

  @IsOptional()
  @IsBoolean()
  businessContext?: boolean;

  @IsOptional()
  @IsBoolean()
  audience?: boolean;

  @IsOptional()
  @IsBoolean()
  objectives?: boolean;

  @IsOptional()
  @IsBoolean()
  tone?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  businessContextValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  audienceValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  objectivesValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  toneValue?: string;
}
