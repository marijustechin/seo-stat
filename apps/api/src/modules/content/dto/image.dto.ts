import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateImageDto {
  // The provider-specific limit is enforced with actionable feedback in the
  // service; this is only a generous hard upper bound.
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  prompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string;
}

export class UploadImageDto {
  @IsString()
  dataBase64!: string;

  @IsString()
  @MaxLength(200)
  fileName!: string;

  @IsIn(['image/png', 'image/jpeg', 'image/webp'])
  mimeType!: 'image/png' | 'image/jpeg' | 'image/webp';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string;
}

export class UpdateImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  prompt?: string;
}

export class SelectImageDto {
  @IsOptional()
  @IsString()
  draftId?: string;
}
