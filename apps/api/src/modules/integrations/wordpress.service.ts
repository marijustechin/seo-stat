import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/index.js';
import { Prisma } from '../../generated/prisma/client.js';
import { renderMarkdownToHtml } from '../../common/markdown/markdown-to-html.js';
import { SafeFetchError, validateUrlShape } from '../../common/net/public-url.js';
import { ContentService } from '../content/content.service.js';
import { ImageService } from '../content/image.service.js';
import type { DraftView } from '../content/content.types.js';
import { CredentialCrypto } from './credential-crypto.js';
import {
  WordpressClient,
  type WordpressCredentials,
  WordpressRequestError,
} from './wordpress/wordpress-client.js';
import type {
  DraftExportView,
  WordpressExportAttemptView,
  WordpressExportStatus,
  WordpressIdentityView,
  WordpressIntegrationView,
} from './wordpress.types.js';

const STALE_IN_PROGRESS_MS = 2 * 60 * 1000;

class RemoteConflict extends Error {}

function hash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Export failed.';
  return message
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

interface DerivedExport {
  payload: { title: string; slug?: string; excerpt?: string; content: string; featuredMedia?: number };
  payloadHash: string;
  mediaHash: string | null;
  cover: { id: string; url: string; buffer: Buffer; mimeType: string; fileName: string; altText: string | null } | null;
}

@Injectable()
export class WordpressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCrypto,
    private readonly client: WordpressClient,
    private readonly content: ContentService,
    private readonly images: ImageService,
  ) {}

  // --- Integration settings -----------------------------------------------

  async getIntegration(projectId: string): Promise<WordpressIntegrationView> {
    await this.requireProject(projectId);
    const record = await this.prisma.wordpressIntegration.findUnique({ where: { projectId } });
    return this.toIntegrationView(record);
  }

  async saveIntegration(
    projectId: string,
    dto: { siteUrl: string; username: string; applicationPassword?: string | null },
  ): Promise<WordpressIntegrationView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project.status);
    if (!this.crypto.isConfigured()) {
      throw new ServiceUnavailableException('Integration encryption key is not configured on the server.');
    }

    const siteUrl = this.normalizeSiteUrl(dto.siteUrl);
    const username = (dto.username ?? '').trim();
    if (!username) throw new BadRequestException('WordPress username is required.');

    const existing = await this.prisma.wordpressIntegration.findUnique({ where: { projectId } });
    const providedPassword = dto.applicationPassword?.trim() ?? '';
    let passwordEncrypted = existing?.passwordEncrypted ?? '';
    if (providedPassword) {
      passwordEncrypted = this.crypto.encrypt(providedPassword);
    } else if (!existing) {
      throw new BadRequestException('An application password is required to connect WordPress.');
    }

    const record = await this.prisma.wordpressIntegration.upsert({
      where: { projectId },
      create: { projectId, siteUrl, username, passwordEncrypted },
      // Changing credentials invalidates the previous connection test.
      update: {
        siteUrl,
        username,
        passwordEncrypted,
        lastTestStatus: null,
        lastTestAt: null,
        lastTestError: null,
        lastTestIdentity: Prisma.DbNull,
      },
    });
    return this.toIntegrationView(record);
  }

  async testIntegration(projectId: string): Promise<WordpressIntegrationView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project.status);
    const record = await this.requireIntegration(projectId);
    const credentials = this.credentialsFor(record);

    let status: 'succeeded' | 'failed' = 'succeeded';
    let error: string | null = null;
    let identity: WordpressIdentityView | null = null;
    try {
      const verified = await this.client.verify(credentials);
      identity = {
        id: verified.id,
        name: verified.name,
        slug: verified.slug,
        roles: verified.roles,
        capabilities: verified.capabilities,
      };
    } catch (err) {
      status = 'failed';
      error = this.describeError(err, 'Connection test failed.');
    }

    const updated = await this.prisma.wordpressIntegration.update({
      where: { projectId },
      data: {
        lastTestStatus: status,
        lastTestAt: new Date(),
        lastTestError: error,
        lastTestIdentity: identity ? (identity as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
    return this.toIntegrationView(updated);
  }

  async disconnect(projectId: string): Promise<WordpressIntegrationView> {
    await this.requireProject(projectId);
    await this.prisma.wordpressIntegration.deleteMany({ where: { projectId } });
    return this.toIntegrationView(null);
  }

  // --- Draft export -------------------------------------------------------

  async getExportState(projectId: string, draftId: string): Promise<DraftExportView> {
    const project = await this.requireProject(projectId);
    const integration = await this.prisma.wordpressIntegration.findUnique({ where: { projectId } });
    const draft = await this.content.getDraft(projectId, draftId);
    const attempts = await this.prisma.wordpressExport.findMany({
      where: { projectId, draftId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const latest = attempts[0] ?? null;
    const succeeded = attempts.find((attempt) => attempt.status === 'succeeded') ?? null;
    const inProgress = attempts.some((attempt) => attempt.status === 'in_progress');
    const derived = await this.deriveExport(projectId, draft);

    const archived = project.status === 'archived';
    const configured = integration !== null && this.crypto.isConfigured();
    let eligible = true;
    let ineligibleReason: string | null = null;
    if (archived) {
      eligible = false;
      ineligibleReason = 'The project is archived; exports and updates are disabled.';
    } else if (!integration) {
      eligible = false;
      ineligibleReason = 'WordPress is not connected for this project.';
    } else if (!this.crypto.isConfigured()) {
      eligible = false;
      ineligibleReason = 'The integration encryption key is not configured on the server.';
    }

    const changedSinceExport = succeeded
      ? succeeded.payloadHash !== derived.payloadHash || succeeded.mediaHash !== derived.mediaHash
      : true;

    return {
      configured,
      encryptionConfigured: this.crypto.isConfigured(),
      siteUrl: integration?.siteUrl ?? null,
      eligible,
      ineligibleReason,
      draft: { id: draft.id, version: draft.version, title: draft.title, updatedAt: draft.updatedAt },
      cover: derived.cover
        ? {
            id: derived.cover.id,
            url: derived.cover.url,
            fileName: derived.cover.fileName,
            hasAlt: Boolean(derived.cover.altText),
            reusedRemoteMediaId: succeeded?.mediaHash === derived.mediaHash ? (succeeded?.remoteMediaId ?? null) : null,
          }
        : null,
      remotePostId: succeeded?.remotePostId ?? null,
      remoteLink: succeeded?.remoteLink ?? null,
      lastExportedVersion: succeeded?.draftVersion ?? null,
      lastExportedAt: succeeded?.finishedAt?.toISOString() ?? null,
      changedSinceExport,
      remoteEditDetected: latest?.status === 'conflict',
      inProgress,
      status: (latest?.status as WordpressExportStatus | undefined) ?? null,
      attempts: attempts.map((attempt) => this.toAttemptView(attempt)),
    };
  }

  async exportDraft(
    projectId: string,
    draftId: string,
    dto: { expectedUpdatedAt?: string },
  ): Promise<DraftExportView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project.status);
    const integration = await this.requireIntegration(projectId);
    const credentials = this.credentialsFor(integration);
    const draft = await this.content.getDraft(projectId, draftId);

    if (dto.expectedUpdatedAt && dto.expectedUpdatedAt !== draft.updatedAt) {
      throw new ConflictException('This draft has unsaved changes. Save the draft before exporting.');
    }
    if (!draft.title || draft.title.trim().length === 0) {
      throw new BadRequestException('The draft needs a title before it can be exported.');
    }

    const derived = await this.deriveExport(projectId, draft);
    await this.clearStaleInProgress(draftId);

    const succeeded = await this.prisma.wordpressExport.findFirst({
      where: { projectId, draftId, status: 'succeeded' },
      orderBy: { createdAt: 'desc' },
    });

    let attempt;
    try {
      attempt = await this.prisma.wordpressExport.create({
        data: {
          projectId,
          draftId,
          draftVersion: draft.version,
          siteUrl: integration.siteUrl,
          status: 'in_progress',
          payloadHash: derived.payloadHash,
          mediaHash: derived.mediaHash,
          remotePostId: succeeded?.remotePostId ?? null,
          remoteMediaId: succeeded?.remoteMediaId ?? null,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('An export is already in progress for this draft.');
      }
      throw error;
    }

    let remoteMediaId = succeeded?.remoteMediaId ?? null;
    try {
      if (derived.cover) {
        const reuse = succeeded && succeeded.mediaHash === derived.mediaHash && succeeded.remoteMediaId;
        if (reuse) {
          remoteMediaId = succeeded?.remoteMediaId ?? null;
        } else {
          const media = await this.client.uploadMedia(credentials, {
            fileName: derived.cover.fileName,
            mimeType: derived.cover.mimeType,
            data: derived.cover.buffer,
            altText: derived.cover.altText ?? undefined,
          });
          remoteMediaId = media.id;
          // Persist the media id immediately so a later failure can reuse it.
          await this.prisma.wordpressExport.update({
            where: { id: attempt.id },
            data: { remoteMediaId },
          });
        }
      }

      const payload = {
        title: derived.payload.title,
        slug: derived.payload.slug,
        excerpt: derived.payload.excerpt,
        content: derived.payload.content,
        featuredMedia: remoteMediaId ?? undefined,
      };

      let post;
      if (succeeded?.remotePostId) {
        const remote = await this.client.getPost(credentials, succeeded.remotePostId);
        if (remote.status !== 'draft') {
          throw new RemoteConflict('The remote post is no longer a draft; it was not changed.');
        }
        if (succeeded.remoteModified && remote.modified !== succeeded.remoteModified) {
          throw new RemoteConflict('The remote post was edited outside seo-stat; it was not overwritten.');
        }
        post = await this.client.updateDraft(credentials, succeeded.remotePostId, payload);
      } else {
        post = await this.client.createDraft(credentials, payload);
      }

      await this.prisma.wordpressExport.update({
        where: { id: attempt.id },
        data: {
          status: 'succeeded',
          remotePostId: post.id,
          remoteMediaId,
          remoteModified: post.modified,
          remoteLink: post.link,
          mediaHash: derived.mediaHash,
          payloadHash: derived.payloadHash,
          error: null,
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof RemoteConflict) {
        await this.failAttempt(attempt.id, 'conflict', error.message, remoteMediaId, succeeded?.remotePostId ?? null);
      } else {
        const classification = this.classify(error);
        await this.failAttempt(
          attempt.id,
          classification.status,
          classification.message,
          remoteMediaId,
          succeeded?.remotePostId ?? null,
        );
      }
    }

    return this.getExportState(projectId, draftId);
  }

  async reconcile(projectId: string, draftId: string): Promise<DraftExportView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project.status);
    const integration = await this.requireIntegration(projectId);
    const credentials = this.credentialsFor(integration);
    const draft = await this.content.getDraft(projectId, draftId);

    const attempt = await this.prisma.wordpressExport.findFirst({
      where: { projectId, draftId, status: { in: ['uncertain', 'conflict'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!attempt) throw new BadRequestException('There is no uncertain or conflicting export to reconcile.');

    try {
      if (attempt.remotePostId) {
        const remote = await this.client.getPost(credentials, attempt.remotePostId).catch((error) => {
          if (error instanceof WordpressRequestError && error.status === 404) return null;
          throw error;
        });
        if (!remote) {
          await this.prisma.wordpressExport.update({
            where: { id: attempt.id },
            data: { status: 'failed', error: 'The remote post no longer exists.', finishedAt: new Date() },
          });
        } else if (remote.status !== 'draft') {
          await this.prisma.wordpressExport.update({
            where: { id: attempt.id },
            data: {
              status: 'conflict',
              error: 'The remote post is no longer a draft; it was not changed.',
              remoteLink: remote.link,
              remoteModified: remote.modified,
              finishedAt: new Date(),
            },
          });
        } else {
          await this.prisma.wordpressExport.update({
            where: { id: attempt.id },
            data: {
              status: 'succeeded',
              remoteLink: remote.link,
              remoteModified: remote.modified,
              error: null,
              finishedAt: new Date(),
            },
          });
        }
      } else if (draft.slug) {
        const found = await this.client.findPostBySlug(credentials, draft.slug);
        if (found) {
          await this.prisma.wordpressExport.update({
            where: { id: attempt.id },
            data: {
              status: 'succeeded',
              remotePostId: found.id,
              remoteLink: found.link,
              remoteModified: found.modified,
              error: null,
              finishedAt: new Date(),
            },
          });
        } else {
          await this.prisma.wordpressExport.update({
            where: { id: attempt.id },
            data: {
              status: 'failed',
              error: 'The create did not reach WordPress; it can be retried.',
              finishedAt: new Date(),
            },
          });
        }
      } else {
        throw new BadRequestException('Cannot reconcile: the draft has no slug to search by. Review WordPress manually.');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const classification = this.classify(error);
      await this.prisma.wordpressExport.update({
        where: { id: attempt.id },
        data: { status: classification.status, error: classification.message, finishedAt: new Date() },
      });
    }

    return this.getExportState(projectId, draftId);
  }

  // --- Helpers ------------------------------------------------------------

  private async deriveExport(projectId: string, draft: DraftView): Promise<DerivedExport> {
    let cover: DerivedExport['cover'] = null;
    const images = await this.images.list(projectId, draft.id);
    const selected = images.find((image) => image.selected && image.status === 'ready') ?? null;
    if (selected) {
      const file = await this.images.read(projectId, selected.id);
      cover = {
        id: selected.id,
        url: `/projects/${projectId}/content/images/${selected.id}/file`,
        buffer: file.buffer,
        mimeType: file.mimeType,
        fileName: file.fileName,
        altText: selected.altText,
      };
    }
    const content = renderMarkdownToHtml(draft.bodyMarkdown);
    const payload = {
      title: draft.title ?? '',
      slug: draft.slug ?? undefined,
      excerpt: draft.excerpt ?? undefined,
      content,
    };
    return {
      payload,
      payloadHash: hash(JSON.stringify(payload)),
      mediaHash: cover ? hash(cover.buffer) : null,
      cover,
    };
  }

  private async clearStaleInProgress(draftId: string): Promise<void> {
    await this.prisma.wordpressExport.updateMany({
      where: { draftId, status: 'in_progress', updatedAt: { lt: new Date(Date.now() - STALE_IN_PROGRESS_MS) } },
      data: { status: 'uncertain', error: 'A previous export did not finish.', finishedAt: new Date() },
    });
  }

  private classify(error: unknown): { status: WordpressExportStatus; message: string } {
    if (error instanceof SafeFetchError) {
      if (error.kind === 'timeout' || error.kind === 'network-error') {
        return {
          status: 'uncertain',
          message: 'WordPress did not respond; the outcome is unknown. Reconcile before retrying.',
        };
      }
      return { status: 'failed', message: sanitizeError(error) };
    }
    if (error instanceof WordpressRequestError) {
      if (error.status === 401 || error.status === 403) {
        return { status: 'failed', message: 'WordPress rejected the credentials (check the Application Password).' };
      }
      return { status: 'failed', message: sanitizeError(error) };
    }
    return { status: 'failed', message: sanitizeError(error) };
  }

  private describeError(error: unknown, fallback: string): string {
    if (error instanceof WordpressRequestError) {
      if (error.status === 401 || error.status === 403) {
        return 'WordPress rejected the credentials. Create a new Application Password and try again.';
      }
      return sanitizeError(error);
    }
    if (error instanceof SafeFetchError) {
      if (error.kind === 'blocked-host' || error.kind === 'invalid-url' || error.kind === 'blocked-address') {
        return 'The WordPress site URL is not an allowed public HTTPS address.';
      }
      if (error.kind === 'timeout' || error.kind === 'network-error') {
        return 'Could not reach the WordPress site.';
      }
      return sanitizeError(error);
    }
    return sanitizeError(error) || fallback;
  }

  private async failAttempt(
    id: string,
    status: WordpressExportStatus,
    error: string,
    remoteMediaId: number | null,
    remotePostId: number | null,
  ): Promise<void> {
    await this.prisma.wordpressExport.update({
      where: { id },
      data: { status, error, remoteMediaId, remotePostId, finishedAt: new Date() },
    });
  }

  private credentialsFor(record: {
    siteUrl: string;
    username: string;
    passwordEncrypted: string;
  }): WordpressCredentials {
    let applicationPassword: string;
    try {
      applicationPassword = this.crypto.decrypt(record.passwordEncrypted);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('The stored WordPress credential could not be read.');
    }
    return { siteUrl: record.siteUrl, username: record.username, applicationPassword };
  }

  private normalizeSiteUrl(raw: string | undefined): string {
    const value = (raw ?? '').trim();
    if (!value) throw new BadRequestException('WordPress site URL is required.');
    let url: URL;
    try {
      url = validateUrlShape(value);
    } catch {
      throw new BadRequestException('Enter a public WordPress site URL (https).');
    }
    if (url.protocol !== 'https:') {
      throw new BadRequestException('WordPress connections require HTTPS.');
    }
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  }

  private toIntegrationView(record: {
    siteUrl: string;
    username: string;
    passwordEncrypted: string;
    lastTestStatus: string | null;
    lastTestAt: Date | null;
    lastTestError: string | null;
    lastTestIdentity: Prisma.JsonValue;
  } | null): WordpressIntegrationView {
    if (!record) {
      return {
        connected: false,
        siteUrl: null,
        username: null,
        hasPassword: false,
        encryptionConfigured: this.crypto.isConfigured(),
        lastTest: null,
      };
    }
    const identity = record.lastTestIdentity as unknown as WordpressIdentityView | null;
    return {
      connected: true,
      siteUrl: record.siteUrl,
      username: record.username,
      hasPassword: record.passwordEncrypted.length > 0,
      encryptionConfigured: this.crypto.isConfigured(),
      lastTest:
        record.lastTestStatus && record.lastTestAt
          ? {
              status: record.lastTestStatus as 'succeeded' | 'failed',
              at: record.lastTestAt.toISOString(),
              error: record.lastTestError,
              identity,
            }
          : null,
    };
  }

  private toAttemptView(record: {
    id: string;
    status: string;
    draftVersion: number;
    createdAt: Date;
    finishedAt: Date | null;
    remotePostId: number | null;
    remoteMediaId: number | null;
    remoteLink: string | null;
    error: string | null;
  }): WordpressExportAttemptView {
    return {
      id: record.id,
      status: record.status as WordpressExportStatus,
      draftVersion: record.draftVersion,
      createdAt: record.createdAt.toISOString(),
      finishedAt: record.finishedAt ? record.finishedAt.toISOString() : null,
      remotePostId: record.remotePostId,
      remoteMediaId: record.remoteMediaId,
      remoteLink: record.remoteLink,
      error: record.error,
    };
  }

  private async requireIntegration(projectId: string) {
    const record = await this.prisma.wordpressIntegration.findUnique({ where: { projectId } });
    if (!record) throw new BadRequestException('WordPress is not connected for this project.');
    return record;
  }

  private async requireProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} was not found`);
    return project;
  }

  private assertActive(status: string): void {
    if (status === 'archived') {
      throw new ConflictException('Archived projects cannot change integrations or export.');
    }
  }
}
