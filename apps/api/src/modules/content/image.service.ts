import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PrismaService } from '../../database/index.js';
import { Prisma } from '../../generated/prisma/client.js';
import { detectImageMime, imageDimensions } from './image-meta.js';
import { ImageProvider, ImageProviderError } from './image.provider.js';
import type { ArticleImageView } from './image.types.js';
import { GenerateImageDto, UpdateImageDto, UploadImageDto } from './dto/image.dto.js';

const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

@Injectable()
export class ImageService {
  /** In-process guard against duplicate generation from repeated clicks. */
  private readonly generating = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: ImageProvider,
  ) {}

  private get assetDir(): string {
    return process.env.CONTENT_ASSET_DIR?.trim() || '/srv/seo-stat/data/content-images';
  }

  status() {
    return {
      provider: this.provider.providerId,
      model: this.provider.model,
      configured: this.provider.isConfigured(),
      maxPromptLength: this.provider.maxPromptLength,
      parameters: this.provider.defaultParameters ?? null,
    };
  }

  async list(projectId: string, draftId: string): Promise<ArticleImageView[]> {
    await this.requireProject(projectId);
    await this.requireDraft(projectId, draftId);
    const images = await this.prisma.articleImage.findMany({
      where: { projectId, draftId },
      orderBy: { version: 'desc' },
    });
    return images.map((image) => this.toView(image));
  }

  async generate(projectId: string, draftId: string, dto: GenerateImageDto): Promise<ArticleImageView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    const draft = await this.requireDraft(projectId, draftId);
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException('Image generation is not configured on the server.');
    }
    const prompt =
      dto.prompt?.trim() ||
      `An editorial illustration for an article titled "${draft.title ?? 'Untitled'}". Conceptual, non-photographic; do not depict real people, customers, facilities, or logos.`;
    const limit = this.provider.maxPromptLength;
    if (limit !== null && prompt.length > limit) {
      throw new BadRequestException(
        `The complete cover prompt is ${prompt.length} characters; ${this.provider.providerId} accepts at most ${limit}. Shorten it by ${prompt.length - limit} character(s) and try again.`,
      );
    }
    if (this.generating.has(draftId)) {
      throw new ConflictException('Cover generation is already in progress for this draft.');
    }
    this.generating.add(draftId);

    const version = await this.nextVersion(draftId);
    try {
      const result = await this.provider.generate({ prompt });
      const buffer = Buffer.from(result.base64, 'base64');
      if (buffer.length === 0) {
        throw new ImageProviderError('invalid', 'The provider returned an empty image.');
      }
      const mimeType = detectImageMime(buffer);
      if (!mimeType) {
        throw new ImageProviderError('invalid', 'The provider returned an image in an unsupported format.');
      }
      const extension = EXTENSION[mimeType] ?? 'png';
      const dims = imageDimensions(buffer, mimeType);
      const storagePath = await this.writeAsset(`${draftId}-v${version}`, extension, buffer);
      const image = await this.prisma.articleImage.create({
        data: {
          projectId,
          draftId,
          version,
          kind: 'generated',
          status: 'ready',
          prompt,
          altText: dto.altText?.slice(0, 500) ?? null,
          provider: this.provider.providerId,
          model: this.provider.model,
          fileName: `cover-v${version}.${extension}`,
          mimeType,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          bytes: buffer.length,
          storagePath,
          usage: this.jsonOrNull(result.usage),
          parameters: this.jsonOrNull(result.parameters),
        },
      });
      return this.toView(image);
    } catch (error) {
      const failure = this.classifyFailure(error);
      await this.prisma.articleImage.create({
        data: {
          projectId,
          draftId,
          version,
          kind: 'generated',
          status: 'failed',
          prompt,
          provider: this.provider.providerId,
          model: this.provider.model,
          parameters: this.jsonOrNull(this.provider.defaultParameters ?? null),
          error: failure.message,
        },
      });
      throw failure.exception;
    } finally {
      this.generating.delete(draftId);
    }
  }

  async upload(projectId: string, draftId: string, dto: UploadImageDto): Promise<ArticleImageView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    await this.requireDraft(projectId, draftId);
    const extension = EXTENSION[dto.mimeType];
    if (!extension) throw new BadRequestException('Unsupported image type.');
    const buffer = Buffer.from(dto.dataBase64, 'base64');
    if (buffer.length === 0) throw new BadRequestException('Empty image upload.');
    if (buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestException('Image exceeds the 6 MB limit.');
    const version = await this.nextVersion(draftId);
    const dims = imageDimensions(buffer, dto.mimeType);
    const storagePath = await this.writeAsset(`${draftId}-upload-v${version}`, extension, buffer);
    const image = await this.prisma.articleImage.create({
      data: {
        projectId,
        draftId,
        version,
        kind: 'uploaded',
        status: 'ready',
        altText: dto.altText?.slice(0, 500) ?? null,
        fileName: basename(dto.fileName).slice(0, 200),
        mimeType: dto.mimeType,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        bytes: buffer.length,
        storagePath,
      },
    });
    return this.toView(image);
  }

  async update(projectId: string, imageId: string, dto: UpdateImageDto): Promise<ArticleImageView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    await this.requireImage(projectId, imageId);
    const limit = this.provider.maxPromptLength;
    if (dto.prompt !== undefined && limit !== null && dto.prompt.length > limit) {
      throw new BadRequestException(
        `The cover prompt is ${dto.prompt.length} characters; ${this.provider.providerId} accepts at most ${limit}.`,
      );
    }
    const image = await this.prisma.articleImage.update({
      where: { id: imageId },
      data: {
        ...(dto.altText !== undefined ? { altText: dto.altText.slice(0, 500) } : {}),
        ...(dto.prompt !== undefined ? { prompt: dto.prompt } : {}),
      },
    });
    return this.toView(image);
  }

  async select(projectId: string, imageId: string, dto: { draftId?: string }): Promise<ArticleImageView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    const image = await this.requireImage(projectId, imageId);
    const draftId = dto.draftId ?? image.draftId;
    if (draftId) {
      await this.prisma.articleImage.updateMany({ where: { projectId, draftId }, data: { selected: false } });
    }
    const selected = await this.prisma.articleImage.update({ where: { id: imageId }, data: { selected: true } });
    return this.toView(selected);
  }

  async read(projectId: string, imageId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const image = await this.requireImage(projectId, imageId);
    if (!image.storagePath || image.status !== 'ready') throw new NotFoundException('Image file is not available.');
    const safe = basename(image.storagePath);
    const buffer = await readFile(join(this.assetDir, safe));
    return {
      buffer,
      mimeType: image.mimeType ?? 'application/octet-stream',
      fileName: basename(image.fileName ?? safe),
    };
  }

  private jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
    return value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
  }

  private classifyFailure(error: unknown): { message: string; exception: HttpException } {
    const message = (error instanceof Error ? error.message : 'Image generation failed.')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
    if (error instanceof ImageProviderError) {
      // Rate-limited vs temporarily over capacity are actionable 429s.
      if (error.kind === 'quota' || error.kind === 'capacity') {
        return { message, exception: new HttpException(message, 429) };
      }
      // A malformed request that the provider rejects is the only client-shaped case.
      if (error.kind === 'invalid') {
        return { message, exception: new BadRequestException(message || 'Image generation is invalid.') };
      }
      // Everything else (bad/insufficient credentials, paid-plan requirement,
      // timeout, network, unknown provider failure) is a server-side provider
      // failure, not invalid user input: report the provider as unavailable.
      return { message, exception: new ServiceUnavailableException(message) };
    }
    return { message, exception: new ServiceUnavailableException(message || 'Image generation failed.') };
  }

  private async nextVersion(draftId: string): Promise<number> {
    const aggregate = await this.prisma.articleImage.aggregate({ where: { draftId }, _max: { version: true } });
    return (aggregate._max.version ?? 0) + 1;
  }

  private async writeAsset(prefix: string, extension: string, buffer: Buffer): Promise<string> {
    await mkdir(this.assetDir, { recursive: true });
    const fileName = `${prefix}.${extension}`;
    await writeFile(join(this.assetDir, fileName), buffer);
    return fileName;
  }

  private assertActive(project: { status: string }) {
    if (project.status === 'archived') {
      throw new BadRequestException('Archived projects cannot change content images.');
    }
  }

  private async requireProject(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} was not found`);
    return project;
  }

  private async requireDraft(projectId: string, draftId: string) {
    const draft = await this.prisma.articleDraft.findFirst({ where: { id: draftId, projectId } });
    if (!draft) throw new NotFoundException('Draft not found for this project.');
    return draft;
  }

  private async requireImage(projectId: string, imageId: string) {
    const image = await this.prisma.articleImage.findFirst({ where: { id: imageId, projectId } });
    if (!image) throw new NotFoundException('Image not found for this project.');
    return image;
  }

  private toView(image: {
    id: string;
    projectId: string;
    draftId: string | null;
    version: number;
    kind: string;
    status: string;
    prompt: string | null;
    altText: string | null;
    provider: string | null;
    model: string | null;
    fileName: string | null;
    mimeType: string | null;
    width: number | null;
    height: number | null;
    bytes: number | null;
    usage: unknown;
    parameters: unknown;
    selected: boolean;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ArticleImageView {
    return {
      id: image.id,
      projectId: image.projectId,
      draftId: image.draftId,
      version: image.version,
      kind: image.kind as 'generated' | 'uploaded',
      status: image.status as 'ready' | 'failed' | 'unavailable',
      prompt: image.prompt,
      altText: image.altText,
      provider: image.provider,
      model: image.model,
      fileName: image.fileName,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      bytes: image.bytes,
      usage: image.usage ?? null,
      parameters: image.parameters ?? null,
      selected: image.selected,
      error: image.error,
      url: `/projects/${image.projectId}/content/images/${image.id}/file`,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
    };
  }
}
