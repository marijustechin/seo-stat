import { IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

/** Identity fields. Changing any of these does not change the project id. */
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  websiteUrl?: string | null;
}
