import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveWordpressIntegrationDto {
  @IsString()
  @MaxLength(2048)
  siteUrl!: string;

  @IsString()
  @MaxLength(200)
  username!: string;

  /** Omit or leave blank to keep the existing stored password. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  applicationPassword?: string | null;
}

export class ExportWordpressDraftDto {
  /** The draft `updatedAt` the client loaded; guards against unsaved edits. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  expectedUpdatedAt?: string;
}
