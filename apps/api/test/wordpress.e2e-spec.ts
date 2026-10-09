import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { PrismaService } from '../src/database/index.js';
import { SafeFetchError } from '../src/common/net/public-url.js';
import {
  WordpressClient,
  WordpressRequestError,
  type WordpressCredentials,
  type WordpressDraftInput,
  type WordpressIdentity,
  type WordpressMedia,
  type WordpressMediaInput,
  type WordpressPost,
} from '../src/modules/integrations/index.js';

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG_1X1_B =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

class StubWordpressClient extends WordpressClient {
  verifyResult: WordpressIdentity = {
    id: 7,
    name: 'Editor Person',
    slug: 'editor',
    roles: ['editor'],
    capabilities: { edit_posts: true, upload_files: true, publish_posts: true },
  };
  verifyError: unknown = null;
  writeError: unknown = null;
  remoteModified = '2026-01-01T00:00:00';
  modifyOverride: string | null = null;
  forceStatus: string | null = null;
  findResult: WordpressPost | null = null;
  nextPostId = 500;
  posts = new Map<number, WordpressPost>();
  createCalls = 0;
  updateCalls = 0;
  uploadCalls = 0;
  verifyCalls = 0;
  lastCreateInput: WordpressDraftInput | null = null;
  lastUpdateInput: WordpressDraftInput | null = null;

  reset(): void {
    this.verifyError = null;
    this.writeError = null;
    this.modifyOverride = null;
    this.forceStatus = null;
    this.findResult = null;
    this.remoteModified = '2026-01-01T00:00:00';
    this.nextPostId = 500;
    this.posts.clear();
    this.createCalls = 0;
    this.updateCalls = 0;
    this.uploadCalls = 0;
    this.verifyCalls = 0;
    this.lastCreateInput = null;
    this.lastUpdateInput = null;
  }

  private link(id: number): string {
    return `https://wp.example.com/?p=${id}`;
  }

  async verify(): Promise<WordpressIdentity> {
    this.verifyCalls += 1;
    if (this.verifyError) throw this.verifyError;
    return this.verifyResult;
  }

  async createDraft(_c: WordpressCredentials, input: WordpressDraftInput): Promise<WordpressPost> {
    this.createCalls += 1;
    this.lastCreateInput = input;
    if (this.writeError) throw this.writeError;
    const id = this.nextPostId++;
    const post: WordpressPost = {
      id,
      status: 'draft',
      link: this.link(id),
      slug: input.slug ?? 'generated',
      modified: this.remoteModified,
      contentRendered: input.content,
    };
    this.posts.set(id, post);
    return post;
  }

  async updateDraft(_c: WordpressCredentials, postId: number, input: WordpressDraftInput): Promise<WordpressPost> {
    this.updateCalls += 1;
    this.lastUpdateInput = input;
    if (this.writeError) throw this.writeError;
    const post: WordpressPost = {
      id: postId,
      status: 'draft',
      link: this.link(postId),
      slug: input.slug ?? 'generated',
      modified: this.remoteModified,
      contentRendered: input.content,
    };
    this.posts.set(postId, post);
    return post;
  }

  async getPost(_c: WordpressCredentials, postId: number): Promise<WordpressPost> {
    const existing = this.posts.get(postId);
    const base: WordpressPost = existing ?? {
      id: postId,
      status: 'draft',
      link: this.link(postId),
      slug: 'x',
      modified: this.remoteModified,
      contentRendered: '',
    };
    return {
      ...base,
      status: this.forceStatus ?? base.status,
      modified: this.modifyOverride ?? base.modified,
    };
  }

  async findPostBySlug(): Promise<WordpressPost | null> {
    return this.findResult;
  }

  async uploadMedia(_c: WordpressCredentials, _input: WordpressMediaInput): Promise<WordpressMedia> {
    this.uploadCalls += 1;
    return { id: 900, sourceUrl: 'https://wp.example.com/media/900.png' };
  }
}

describe('WordPress integration and draft export (mocked client)', () => {
  let app: NestFastifyApplication;
  let server: FastifyInstance;
  let prisma: PrismaService;
  const wordpress = new StubWordpressClient();
  const created: string[] = [];
  const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;

  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: Record<string, unknown>) =>
    server.inject({ method, url: `/seo-stat/api${url}`, ...(payload ? { payload } : {}) });

  const createProject = async (name: string): Promise<string> => {
    const res = await call('POST', '/projects', { name, websiteUrl: 'https://example.com' });
    const id = res.json().id as string;
    created.push(id);
    return id;
  };

  const connect = async (projectId: string, password = 'abcd efgh ijkl mnop') => {
    const res = await call('PUT', `/projects/${projectId}/integrations/wordpress`, {
      siteUrl: 'https://wp.example.com',
      username: 'editor',
      applicationPassword: password,
    });
    expect(res.statusCode).toBe(200);
    return res;
  };

  const makeDraft = async (projectId: string): Promise<string> => {
    const topic = await prisma.contentTopic.create({
      data: { projectId, title: 'Export topic', audience: 'A', objective: 'O', angle: 'Angle' },
    });
    const draft = await prisma.articleDraft.create({
      data: {
        projectId,
        topicId: topic.id,
        title: 'Exportable Article',
        slug: 'exportable-article',
        excerpt: 'A short excerpt.',
        seoTitle: 'Local SEO title',
        metaDescription: 'Local meta description.',
        bodyMarkdown: '# Heading\n\nHello **world** and [link](https://example.com).\n\n- one\n- two',
      },
    });
    return draft.id;
  };

  const addCover = async (projectId: string, draftId: string, data = PNG_1X1, alt = 'Cover alt') => {
    const uploaded = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/upload`, {
      dataBase64: data,
      fileName: 'cover.png',
      mimeType: 'image/png',
      altText: alt,
    });
    expect(uploaded.statusCode).toBe(201);
    const imageId = uploaded.json().id as string;
    expect((await call('POST', `/projects/${projectId}/content/images/${imageId}/select`)).statusCode).toBe(201);
    return imageId;
  };

  const updatedAtOf = async (draftId: string): Promise<string> => {
    const draft = await prisma.articleDraft.findUniqueOrThrow({ where: { id: draftId } });
    return draft.updatedAt.toISOString();
  };

  beforeAll(async () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'a'.repeat(64);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WordpressClient)
      .useValue(wordpress)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ routerOptions: { ignoreTrailingSlash: true } }),
    );
    configureApp(app);
    await app.init();
    server = app.getHttpAdapter().getInstance() as FastifyInstance;
    await server.ready();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    wordpress.reset();
  });

  afterAll(async () => {
    if (created.length > 0) await prisma.project.deleteMany({ where: { id: { in: created } } });
    await app.close();
    if (originalKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
  });

  it('stores an encrypted connection and never returns the password', async () => {
    const projectId = await createProject('WP Credentials');
    const saved = await connect(projectId, 'abcd efgh ijkl mnop');
    expect(saved.json().connected).toBe(true);
    expect(saved.json().hasPassword).toBe(true);
    expect(saved.json().encryptionConfigured).toBe(true);
    expect(JSON.stringify(saved.json())).not.toContain('abcd efgh');
    const stored = await prisma.wordpressIntegration.findUniqueOrThrow({ where: { projectId } });
    expect(stored.passwordEncrypted).not.toContain('abcd efgh');
    expect(stored.passwordEncrypted.startsWith('v1.')).toBe(true);

    // Blank password preserves the stored credential.
    const updated = await call('PUT', `/projects/${projectId}/integrations/wordpress`, {
      siteUrl: 'https://wp.example.com',
      username: 'editor-2',
    });
    expect(updated.json().username).toBe('editor-2');
    expect(updated.json().hasPassword).toBe(true);

    // Isolation.
    const other = await createProject('WP Credentials Other');
    expect((await call('GET', `/projects/${other}/integrations/wordpress`)).json().connected).toBe(false);

    // HTTP is refused.
    const http = await call('PUT', `/projects/${projectId}/integrations/wordpress`, {
      siteUrl: 'http://wp.example.com',
      username: 'editor',
      applicationPassword: 'x',
    });
    expect(http.statusCode).toBe(400);
  });

  it('tests the connection and records identity or a sanitized failure without creating content', async () => {
    const projectId = await createProject('WP Test');
    await connect(projectId);
    const before = wordpress.createCalls;

    const ok = await call('POST', `/projects/${projectId}/integrations/wordpress/test`);
    expect(ok.statusCode).toBe(201);
    expect(ok.json().lastTest.status).toBe('succeeded');
    expect(ok.json().lastTest.identity.name).toBe('Editor Person');
    expect(wordpress.createCalls).toBe(before);

    wordpress.verifyError = new WordpressRequestError(401, 'incorrect_password', 'the password is wrong');
    const failed = await call('POST', `/projects/${projectId}/integrations/wordpress/test`);
    expect(failed.json().lastTest.status).toBe('failed');
    expect(String(failed.json().lastTest.error)).toMatch(/credential/i);
    wordpress.verifyError = null;
  });

  it('exports a draft as a WordPress draft with safe HTML, cover, and alt text', async () => {
    const projectId = await createProject('WP Export');
    await connect(projectId);
    const draftId = await makeDraft(projectId);
    await addCover(projectId, draftId, PNG_1X1, 'A descriptive alt');

    const res = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    expect(res.statusCode).toBe(201);
    const state = res.json();
    expect(state.remotePostId).toBe(500);
    expect(state.status).toBe('succeeded');
    expect(state.changedSinceExport).toBe(false);
    expect(state.cover.reusedRemoteMediaId).toBe(900);
    expect(state.remoteLink).toContain('wp.example.com');

    const input = wordpress.lastCreateInput;
    expect(input).not.toBeNull();
    expect(input?.content).toContain('<h1>Heading</h1>');
    expect(input?.content).toContain('<strong>world</strong>');
    expect(input?.content).toContain('<a href="https://example.com"');
    expect(input?.featuredMedia).toBe(900);
    // SEO fields stay local and are never sent to WordPress.
    expect(input).not.toHaveProperty('seoTitle');
    expect(input).not.toHaveProperty('metaDescription');
    expect(input).not.toHaveProperty('yoast');
    expect(wordpress.uploadCalls).toBe(1);
  });

  it('prevents concurrent exports (repeated clicks)', async () => {
    const projectId = await createProject('WP Concurrency');
    await connect(projectId);
    const draftId = await makeDraft(projectId);
    await prisma.wordpressExport.create({
      data: {
        projectId,
        draftId,
        draftVersion: 1,
        siteUrl: 'https://wp.example.com',
        status: 'in_progress',
        payloadHash: 'x',
      },
    });
    const res = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    expect(res.statusCode).toBe(409);
  });

  it('updates the same remote draft and reuses unchanged media; a new cover re-uploads', async () => {
    const projectId = await createProject('WP Update');
    await connect(projectId);
    const draftId = await makeDraft(projectId);
    await addCover(projectId, draftId, PNG_1X1);

    await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    expect(wordpress.createCalls).toBe(1);
    expect(wordpress.uploadCalls).toBe(1);

    await prisma.articleDraft.update({
      where: { id: draftId },
      data: { bodyMarkdown: '# Heading\n\nUpdated body.', excerpt: 'Updated excerpt.' },
    });
    const second = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    expect(second.json().remotePostId).toBe(500);
    expect(wordpress.updateCalls).toBe(1);
    expect(wordpress.createCalls).toBe(1);
    expect(wordpress.uploadCalls).toBe(1);

    await addCover(projectId, draftId, PNG_1X1_B, 'New alt');
    await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    expect(wordpress.uploadCalls).toBe(2);
    expect(second.json().remotePostId).toBe(500);
  });

  it('records a partial failure with the uploaded media id so a retry can reuse it', async () => {
    const projectId = await createProject('WP Partial');
    await connect(projectId);
    const draftId = await makeDraft(projectId);
    await addCover(projectId, draftId);

    wordpress.writeError = new WordpressRequestError(400, 'rest_invalid_param', 'bad request');
    const res = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('failed');
    expect(res.json().attempts[0].remoteMediaId).toBe(900);
    expect(res.json().inProgress).toBe(false);
    wordpress.writeError = null;
  });

  it('marks ambiguous timeouts uncertain and reconciles without a blind retry', async () => {
    const projectId = await createProject('WP Uncertain');
    await connect(projectId);
    const draftId = await makeDraft(projectId);

    wordpress.writeError = new SafeFetchError('timeout', 'Request timed out.');
    const res = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    expect(res.json().status).toBe('uncertain');
    expect(wordpress.createCalls).toBe(1);
    wordpress.writeError = null;

    wordpress.findResult = {
      id: 777,
      status: 'draft',
      link: 'https://wp.example.com/?p=777',
      slug: 'exportable-article',
      modified: '2026-02-02T00:00:00',
      contentRendered: '',
    };
    const reconciled = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/reconcile`);
    expect(reconciled.json().status).toBe('succeeded');
    expect(reconciled.json().remotePostId).toBe(777);
  });

  it('detects remote edits and non-draft status instead of overwriting', async () => {
    const projectId = await createProject('WP Conflict');
    await connect(projectId);
    const draftId = await makeDraft(projectId);
    await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });

    wordpress.modifyOverride = 'someone-edited-this';
    const conflict = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    expect(conflict.json().status).toBe('conflict');
    expect(wordpress.updateCalls).toBe(0);

    wordpress.modifyOverride = null;
    wordpress.forceStatus = 'publish';
    const published = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    expect(published.json().status).toBe('conflict');
    expect(wordpress.updateCalls).toBe(0);
    wordpress.forceStatus = null;
  });

  it('guards unsaved edits and rejects exports for archived projects', async () => {
    const projectId = await createProject('WP Guard');
    await connect(projectId);
    const draftId = await makeDraft(projectId);

    const stale = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: '2000-01-01T00:00:00.000Z',
    });
    expect(stale.statusCode).toBe(409);

    await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    await call('POST', `/projects/${projectId}/archive`);
    const archivedExport = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    expect(archivedExport.statusCode).toBe(409);
    expect((await call('GET', `/projects/${projectId}/content/drafts/${draftId}/wordpress`)).statusCode).toBe(200);
  });

  it('preserves the review policy and local SEO fields', async () => {
    const projectId = await createProject('WP Policy');
    await connect(projectId);
    const draftId = await makeDraft(projectId);
    await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    const project = (await call('GET', `/projects/${projectId}`)).json();
    expect(project.publishingPolicy).toBe('review');
    const draft = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}`)).json();
    expect(draft.seoTitle).toBe('Local SEO title');
    expect(draft.metaDescription).toBe('Local meta description.');
  });

  it('rejects export when WordPress is not connected', async () => {
    const projectId = await createProject('WP Not Connected');
    const draftId = await makeDraft(projectId);
    const res = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/wordpress/export`, {
      expectedUpdatedAt: await updatedAtOf(draftId),
    });
    expect(res.statusCode).toBe(400);
  });
});
