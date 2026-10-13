import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { FastifyInstance } from 'fastify';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { PrismaService } from '../src/database/index.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import {
  AnalysisProvider,
  type AnalysisModelRequest,
  type AnalysisModelResult,
} from '../src/modules/analysis/ai/ai-provider.js';
import { AnalysisResearch } from '../src/modules/analysis/research/research.port.js';
import { ContentRunner } from '../src/modules/content/content.runner.js';
import { ContentLinkSource } from '../src/modules/content/content.links.js';
import { ImageProvider, ImageProviderError } from '../src/modules/content/image.provider.js';

// A 1x1 PNG (valid signature + IHDR), used to exercise upload and generation paths.
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
// JPEG signature bytes, to prove the stored format follows the bytes, not a hint.
const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]).toString('base64');

function topicSuggestion(index: number) {
  return {
    title: `Topic ${index}`,
    audience: `Audience ${index}`,
    objective: 'Objective',
    readerNeed: 'Need',
    angle: 'Angle',
    callToAction: 'Act',
    relevance: 'Relevant',
    informationNeeded: 'Confirm coverage',
    informationRequirements: ['Confirm coverage', 'What result does the client expect?'],
    objectiveAlignment: 'Serves the stated objective',
    priority: index === 1 ? 'primary' : 'secondary',
    sources: [{ url: 'https://example.com', note: 'home', retrievedAt: '2026-01-01T00:00:00.000Z' }],
  };
}

const DEFAULT_PAGE = {
  source: 'website' as const,
  url: 'https://example.com',
  title: 'Home',
  fetchedAt: '2026-01-01T00:00:00.000Z',
  excerpt: 'We collect textiles.',
};

const DEFAULT_ARTICLE = {
  title: 'Reuse and Zero Landfill Explained',
  excerpt: 'Short excerpt.',
  bodyMarkdown: '# Heading\n\nBody text.',
  slug: 'generated-title',
  seoTitle: 'SEO title',
  metaDescription: 'Meta description.',
  callToAction: 'Contact us',
  sources: [{ url: 'https://example.com', note: 'home' }],
  unresolvedClaims: ['Confirm collection coverage'],
};

class StubProvider extends AnalysisProvider {
  readonly providerId = 'stub';
  readonly model = 'stub-model';
  configured = true;
  fail = false;
  extraTopics = 0;
  /** When set, the article call returns exactly this output. */
  article: Record<string, unknown> | null = null;

  isConfigured(): boolean {
    return this.configured;
  }

  async analyze(request: AnalysisModelRequest): Promise<AnalysisModelResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (this.fail) throw new Error('provider exploded near 127.0.0.1');
    if (request.schemaName === 'content_topics') {
      const count = 5 + this.extraTopics;
      return { output: { topics: Array.from({ length: count }, (_v, i) => topicSuggestion(i + 1)) }, inputTokens: 100, outputTokens: 50 };
    }
    return {
      output: this.article ?? DEFAULT_ARTICLE,
      inputTokens: 200,
      outputTokens: 100,
    };
  }
}

class StubResearch extends AnalysisResearch {
  pages: Array<{
    source: 'website' | 'competitor';
    url: string;
    title: string;
    fetchedAt: string;
    excerpt: string;
  }> = [{ ...DEFAULT_PAGE }];
  failures: Array<{ source: 'website' | 'competitor'; url: string; reason: string }> = [];

  async collect() {
    return {
      pages: this.pages,
      failures: this.failures,
      websiteReadable: this.pages.length > 0,
      backend: 'direct' as const,
      firecrawlCredits: null,
    };
  }
}

class StubLinkSource extends ContentLinkSource {
  urls: string[] = ['https://example.com/wholesale', 'https://example.com/contacts'];

  async sitemapUrls(): Promise<string[]> {
    return this.urls;
  }
}

class StubImageProvider extends ImageProvider {
  readonly providerId = 'stub-image';
  readonly model = 'stub-image-model';
  readonly maxPromptLength = 2048;
  configured = false;
  calls = 0;
  /** Return JPEG bytes while (incorrectly) hinting PNG, to exercise detection. */
  jpeg = false;
  /** Block inside generate until release() is called, to exercise the click guard. */
  hold = false;
  release: (() => void) | null = null;
  /** Throw a server-side credential failure, to exercise the 503 mapping. */
  authFailure = false;

  isConfigured(): boolean {
    return this.configured;
  }

  async generate() {
    this.calls += 1;
    if (this.authFailure) {
      throw new ImageProviderError('auth', 'Cloudflare rejected the credentials (HTTP 401).');
    }
    if (this.hold) {
      await new Promise<void>((resolve) => {
        this.release = resolve;
      });
    }
    return this.jpeg
      ? { base64: JPEG_BASE64, mimeType: 'image/png', usage: null, parameters: { steps: 4 } }
      : { base64: PNG_1X1, mimeType: 'image/png', usage: { stub: true }, parameters: { steps: 4 } };
  }
}

describe('Content (integration, mocked provider)', () => {
  let app: NestFastifyApplication;
  let server: FastifyInstance;
  let prisma: PrismaService;
  let runner: ContentRunner;
  const provider = new StubProvider();
  const imageProvider = new StubImageProvider();
  const research = new StubResearch();
  const linkSource = new StubLinkSource();
  const created: string[] = [];
  let assetDir: string;

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: Record<string, unknown>) =>
    server.inject({ method, url: `/seo-stat/api${url}`, ...(payload ? { payload } : {}) });

  const createProject = async (name: string): Promise<string> => {
    const res = await call('POST', '/projects', {
      name,
      websiteUrl: 'https://example.com',
      businessContext: 'Saved business context',
      audience: 'Saved audience',
      objectives: 'Saved objectives',
      tone: 'saved tone',
    });
    const id = res.json().id as string;
    created.push(id);
    return id;
  };

  const waitForRun = async (projectId: string, runId: string, timeoutMs = 10_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await call('GET', `/projects/${projectId}/content/runs/${runId}`);
      const body = res.json();
      if (body.status === 'completed' || body.status === 'failed' || body.status === 'interrupted') return body;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('content run did not finish');
  };

  beforeAll(async () => {
    assetDir = await mkdtemp(join(tmpdir(), 'seo-stat-images-'));
    process.env.CONTENT_ASSET_DIR = assetDir;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AnalysisProvider)
      .useValue(provider)
      .overrideProvider(AnalysisResearch)
      .useValue(research)
      .overrideProvider(ContentLinkSource)
      .useValue(linkSource)
      .overrideProvider(ImageProvider)
      .useValue(imageProvider)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ routerOptions: { ignoreTrailingSlash: true } }),
    );
    configureApp(app);
    await app.init();
    server = app.getHttpAdapter().getInstance() as FastifyInstance;
    await server.ready();
    prisma = app.get(PrismaService);
    runner = app.get(ContentRunner);
  });

  afterAll(async () => {
    if (created.length > 0) await prisma.project.deleteMany({ where: { id: { in: created } } });
    await app.close();
    await rm(assetDir, { recursive: true, force: true });
  });

  it('generates topics from saved settings and prevents duplicate starts', async () => {
    const projectId = await createProject('Content Topics');
    const started = await call('POST', `/projects/${projectId}/content/topics/generate`);
    expect(started.statusCode).toBe(201);
    const runId = started.json().id as string;
    expect(started.json().inputSnapshot.businessContext).toBe('Saved business context');
    expect(started.json().inputSnapshot.tone).toBe('saved tone');

    const duplicate = await call('POST', `/projects/${projectId}/content/topics/generate`);
    expect(duplicate.statusCode).toBe(409);

    const done = await waitForRun(projectId, runId);
    expect(done.status).toBe('completed');
    expect(done.provider).toBe('stub');

    const topics = (await call('GET', `/projects/${projectId}/content/topics`)).json();
    expect(topics.length).toBeGreaterThanOrEqual(1);
    expect(topics.length).toBeLessThanOrEqual(5);
    expect(topics[0].title).toContain('Topic');
    expect(topics[0].objectiveAlignment).toBeTruthy();
    expect(['primary', 'secondary', 'supporting']).toContain(topics[0].priority);
  });

  it('supports manual topic create, edit, and dismiss', async () => {
    const projectId = await createProject('Content Manual');
    const createdTopic = await call('POST', `/projects/${projectId}/content/topics`, {
      title: 'Manual topic',
      audience: 'Manual audience',
      objective: 'Manual objective',
      angle: 'Manual angle',
    });
    expect(createdTopic.statusCode).toBe(201);
    const topicId = createdTopic.json().id as string;

    const edited = await call('PATCH', `/projects/${projectId}/content/topics/${topicId}`, { title: 'Edited manual' });
    expect(edited.json().title).toBe('Edited manual');

    const dismissed = await call('POST', `/projects/${projectId}/content/topics/${topicId}/dismiss`);
    expect(dismissed.json().status).toBe('dismissed');
  });

  it('prefills and saves an editable brief', async () => {
    const projectId = await createProject('Content Brief');
    const topic = (await call('POST', `/projects/${projectId}/content/topics`, {
      title: 'Brief topic',
      audience: 'A',
      objective: 'O',
      angle: 'Angle',
    })).json();

    const missing = await call('GET', `/projects/${projectId}/content/topics/${topic.id}/brief`);
    expect(missing.statusCode).toBe(404);

    const brief = await call('PUT', `/projects/${projectId}/content/topics/${topic.id}/brief`, {
      businessOutcome: 'Win agreements',
      destinationUrl: 'https://example.com/contact',
      confirmations: ['Confirm coverage'],
    });
    expect(brief.statusCode).toBe(200);
    expect(brief.json().title).toBe('Brief topic');
    expect(brief.json().businessOutcome).toBe('Win agreements');

    const reread = (await call('GET', `/projects/${projectId}/content/topics/${topic.id}/brief`)).json();
    expect(reread.destinationUrl).toBe('https://example.com/contact');
  });

  it('generates a draft, supports manual saving, and detects stale saves', async () => {
    const projectId = await createProject('Content Draft');
    const topic = (await call('POST', `/projects/${projectId}/content/topics`, {
      title: 'Draft topic',
      audience: 'A',
      objective: 'O',
      angle: 'Angle',
    })).json();

    const started = await call('POST', `/projects/${projectId}/content/topics/${topic.id}/draft`);
    expect(started.statusCode).toBe(201);
    const done = await waitForRun(projectId, started.json().id as string);
    expect(done.status).toBe('completed');
    const draftId = (done.result as { draftId: string }).draftId;

    const draft = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}`)).json();
    expect(draft.version).toBe(1);
    expect(draft.bodyMarkdown).toContain('Heading');
    // The unsupported headline claim was neutralized and recorded.
    expect(draft.title).not.toMatch(/zero[-\s]?landfill/i);
    expect(draft.unresolvedClaims.length).toBeGreaterThanOrEqual(1);
    expect(draft.unresolvedClaims.some((claim: string) => /zero landfill/i.test(claim))).toBe(true);

    const saved = await call('PATCH', `/projects/${projectId}/content/drafts/${draftId}`, {
      bodyMarkdown: 'Manually edited',
      expectedUpdatedAt: draft.updatedAt,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().savedAt).not.toBeNull();

    const stale = await call('PATCH', `/projects/${projectId}/content/drafts/${draftId}`, {
      bodyMarkdown: 'Stale edit',
      expectedUpdatedAt: draft.updatedAt,
    });
    expect(stale.statusCode).toBe(409);
  });

  it('regeneration preserves the previous saved draft version', async () => {
    const projectId = await createProject('Content Regen');
    const topic = (await call('POST', `/projects/${projectId}/content/topics`, {
      title: 'Regen topic',
      audience: 'A',
      objective: 'O',
      angle: 'Angle',
    })).json();

    const first = await waitForRun(projectId, (await call('POST', `/projects/${projectId}/content/topics/${topic.id}/draft`)).json().id);
    const second = await waitForRun(projectId, (await call('POST', `/projects/${projectId}/content/topics/${topic.id}/draft`)).json().id);

    const versions = (await call('GET', `/projects/${projectId}/content/drafts`)).json().map((d: { version: number }) => d.version);
    expect(versions).toContain(1);
    expect(versions).toContain(2);
    expect((first.result as { version: number }).version).toBe(1);
    expect((second.result as { version: number }).version).toBe(2);
  });

  it('clamps over-long topic arrays and records failures with sanitized errors', async () => {
    const projectId = await createProject('Content Limits');
    provider.extraTopics = 3; // returns 8 topics
    const run = await waitForRun(projectId, (await call('POST', `/projects/${projectId}/content/topics/generate`)).json().id);
    provider.extraTopics = 0;
    expect(run.status).toBe('completed');
    const topics = (await call('GET', `/projects/${projectId}/content/topics`)).json();
    expect(topics.length).toBeLessThanOrEqual(5);

    provider.fail = true;
    const failed = await waitForRun(projectId, (await call('POST', `/projects/${projectId}/content/topics/generate`)).json().id);
    provider.fail = false;
    expect(failed.status).toBe('failed');
    expect(failed.error).toBeTruthy();
    expect(failed.error).not.toContain('127.0.0.1');
  });

  it('marks stale running content runs interrupted on startup', async () => {
    const projectId = await createProject('Content Interrupted');
    const stale = await prisma.contentRun.create({
      data: { projectId, kind: 'topics', status: 'running', inputSnapshot: {} as Prisma.InputJsonValue },
    });
    await runner.onModuleInit();
    const res = await call('GET', `/projects/${projectId}/content/runs/${stale.id}`);
    expect(res.json().status).toBe('interrupted');
  });

  it('keeps projects isolated', async () => {
    const a = await createProject('Content Iso A');
    const b = await createProject('Content Iso B');
    const topic = (await call('POST', `/projects/${a}/content/topics`, {
      title: 'Iso topic',
      audience: 'A',
      objective: 'O',
      angle: 'Angle',
    })).json();
    const cross = await call('GET', `/projects/${b}/content/topics/${topic.id}/brief`);
    expect(cross.statusCode).toBe(404);
  });

  it('rejects generation and editing for archived projects but keeps history', async () => {
    const projectId = await createProject('Content Archived');
    const topic = (await call('POST', `/projects/${projectId}/content/topics`, {
      title: 'Archived topic',
      audience: 'A',
      objective: 'O',
      angle: 'Angle',
    })).json();
    await call('POST', `/projects/${projectId}/archive`);

    expect((await call('POST', `/projects/${projectId}/content/topics/generate`)).statusCode).toBe(409);
    expect(
      (await call('PATCH', `/projects/${projectId}/content/topics/${topic.id}`, { title: 'changed' })).statusCode,
    ).toBe(409);
    const list = await call('GET', `/projects/${projectId}/content/topics`);
    expect(list.statusCode).toBe(200);
    expect(list.json().length).toBeGreaterThanOrEqual(1);
  });

  it('round-trips topic requirements and brief answers into the article snapshot', async () => {
    const projectId = await createProject('Content Answers');
    const topic = (await call('POST', `/projects/${projectId}/content/topics`, {
      title: 'Answers topic',
      audience: 'A',
      objective: 'O',
      angle: 'Angle',
    })).json();

    const requirements = [
      { id: 'r1', question: 'Can you collect batteries?', answer: 'Yes, on request.', sourceUrl: 'https://example.com/batteries', state: 'answered' },
      { id: 'r2', question: 'What is the exact tonnage?', answer: null, sourceUrl: null, state: 'unknown' },
      { id: 'r3', question: 'Are you ISO certified?', answer: null, sourceUrl: null, state: 'exclude' },
    ];
    const edited = await call('PATCH', `/projects/${projectId}/content/topics/${topic.id}`, { requirements });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().requirements).toHaveLength(3);
    expect(edited.json().requirements[0].answer).toBe('Yes, on request.');
    expect(edited.json().requirements[2].state).toBe('exclude');

    const brief = await call('PUT', `/projects/${projectId}/content/topics/${topic.id}/brief`, { answers: requirements });
    expect(brief.statusCode).toBe(200);
    expect(brief.json().answers).toHaveLength(3);
    expect(brief.json().answers[1].state).toBe('unknown');

    const reread = (await call('GET', `/projects/${projectId}/content/topics/${topic.id}/brief`)).json();
    expect(reread.answers[2].state).toBe('exclude');

    const started = await call('POST', `/projects/${projectId}/content/topics/${topic.id}/draft`);
    const snapshot = started.json().inputSnapshot.brief.answers as Array<{ id: string; state: string }>;
    expect(snapshot).toHaveLength(3);
    expect(snapshot.find((item) => item.id === 'r3')?.state).toBe('exclude');
    await waitForRun(projectId, started.json().id as string);
  });

  it('keeps each topic answers when switching topics', async () => {
    const projectId = await createProject('Content Switch');
    const a = (await call('POST', `/projects/${projectId}/content/topics`, {
      title: 'Switch A', audience: 'A', objective: 'O', angle: 'Angle',
    })).json();
    const b = (await call('POST', `/projects/${projectId}/content/topics`, {
      title: 'Switch B', audience: 'A', objective: 'O', angle: 'Angle',
    })).json();

    await call('PUT', `/projects/${projectId}/content/topics/${a.id}/brief`, {
      answers: [{ id: 'a1', question: 'Q', answer: 'Answer only for A', state: 'answered' }],
    });
    const missingBrief = await call('GET', `/projects/${projectId}/content/topics/${b.id}/brief`);
    expect(missingBrief.statusCode).toBe(404);

    const briefA = (await call('GET', `/projects/${projectId}/content/topics/${a.id}/brief`)).json();
    expect(briefA.answers).toHaveLength(1);
    expect(briefA.answers[0].answer).toBe('Answer only for A');
  });

  it('manages reusable project knowledge and includes it in the article snapshot', async () => {
    const projectId = await createProject('Content Knowledge');
    const topic = (await call('POST', `/projects/${projectId}/content/topics`, {
      title: 'Knowledge topic', audience: 'A', objective: 'O', angle: 'Angle',
    })).json();

    const created = await call('POST', `/projects/${projectId}/content/knowledge`, {
      text: 'We operate 7 days a week.',
      originQuestion: 'Opening hours?',
      originTopicId: topic.id,
    });
    expect(created.statusCode).toBe(201);
    const knowledgeId = created.json().id as string;

    const list = (await call('GET', `/projects/${projectId}/content/knowledge`)).json();
    expect(list).toHaveLength(1);
    expect(list[0].text).toBe('We operate 7 days a week.');

    const started = await call('POST', `/projects/${projectId}/content/topics/${topic.id}/draft`);
    expect(started.json().inputSnapshot.knowledge).toContain('We operate 7 days a week.');
    await waitForRun(projectId, started.json().id as string);

    const updated = await call('PATCH', `/projects/${projectId}/content/knowledge/${knowledgeId}`, { text: 'Updated note.' });
    expect(updated.json().text).toBe('Updated note.');

    const removed = await call('DELETE', `/projects/${projectId}/content/knowledge/${knowledgeId}`);
    expect(removed.statusCode).toBe(200);
    expect((await call('GET', `/projects/${projectId}/content/knowledge`)).json()).toHaveLength(0);
  });

  it('flags drafts as stale after the brief answers change', async () => {
    const projectId = await createProject('Content Stale Answers');
    const topic = (await call('POST', `/projects/${projectId}/content/topics`, {
      title: 'Stale topic', audience: 'A', objective: 'O', angle: 'Angle',
    })).json();

    await call('PUT', `/projects/${projectId}/content/topics/${topic.id}/brief`, {
      answers: [{ id: 's1', question: 'Q', answer: 'Original', state: 'answered' }],
    });
    const first = await waitForRun(projectId, (await call('POST', `/projects/${projectId}/content/topics/${topic.id}/draft`)).json().id);
    const firstDraftId = (first.result as { draftId: string }).draftId;

    let drafts = (await call('GET', `/projects/${projectId}/content/drafts`)).json() as Array<{ id: string; stale: boolean }>;
    expect(drafts.find((draft) => draft.id === firstDraftId)?.stale).toBe(false);

    await call('PUT', `/projects/${projectId}/content/topics/${topic.id}/brief`, {
      answers: [{ id: 's1', question: 'Q', answer: 'Changed', state: 'answered' }],
    });
    drafts = (await call('GET', `/projects/${projectId}/content/drafts`)).json() as Array<{ id: string; stale: boolean }>;
    expect(drafts.find((draft) => draft.id === firstDraftId)?.stale).toBe(true);

    const regenerated = await waitForRun(projectId, (await call('POST', `/projects/${projectId}/content/topics/${topic.id}/draft`)).json().id);
    const regeneratedId = (regenerated.result as { draftId: string }).draftId;
    drafts = (await call('GET', `/projects/${projectId}/content/drafts`)).json() as Array<{ id: string; stale: boolean }>;
    expect(drafts.find((draft) => draft.id === regeneratedId)?.stale).toBe(false);
  });

  it('manages cover images: upload, preview, select, alt, reload, regenerate, usage, and project scoping', async () => {
    const projectId = await createProject('Content Images');
    const topic = (await call('POST', `/projects/${projectId}/content/topics`, {
      title: 'Image topic', audience: 'A', objective: 'O', angle: 'Angle',
    })).json();
    const run = await waitForRun(projectId, (await call('POST', `/projects/${projectId}/content/topics/${topic.id}/draft`)).json().id);
    const draftId = (run.result as { draftId: string }).draftId;

    imageProvider.configured = false;
    expect(
      (await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/generate`, { prompt: 'x' })).statusCode,
    ).toBe(503);

    // Upload. The `call` helper sends no authorization header or cookie: the API
    // has no authentication, so a 201 here also documents that image access is
    // gated only by project/draft association, not by identity.
    const uploaded = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/upload`, {
      dataBase64: PNG_1X1,
      fileName: 'cover.png',
      mimeType: 'image/png',
      altText: 'A cover',
    });
    expect(uploaded.statusCode).toBe(201);
    const image = uploaded.json();
    expect(image.kind).toBe('uploaded');
    expect(image.status).toBe('ready');
    expect(image.width).toBe(1);
    expect(image.bytes).toBeGreaterThan(0);
    expect(image.usage).toBeNull();

    // Reload (list): the upload is persisted with its alt text.
    const list = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}/images`)).json() as Array<{
      id: string;
      selected: boolean;
      altText: string | null;
    }>;
    expect(list).toHaveLength(1);
    expect(list[0]?.altText).toBe('A cover');

    // Assets are written to the asset directory (outside the release dir).
    expect((await readdir(assetDir)).length).toBeGreaterThan(0);

    // Select, then reload: selection is persisted.
    await call('POST', `/projects/${projectId}/content/images/${image.id}/select`);
    const selected = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}/images`)).json() as Array<{ id: string; selected: boolean }>;
    expect(selected.find((item) => item.id === image.id)?.selected).toBe(true);

    // Edit alt text, then reload: persisted.
    const patched = await call('PATCH', `/projects/${projectId}/content/images/${image.id}`, { altText: 'Updated alt' });
    expect(patched.json().altText).toBe('Updated alt');
    const afterAlt = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}/images`)).json() as Array<{ id: string; altText: string | null }>;
    expect(afterAlt.find((item) => item.id === image.id)?.altText).toBe('Updated alt');

    // Preview/serve through the project-scoped route.
    const file = await call('GET', `/projects/${projectId}/content/images/${image.id}/file`);
    expect(file.statusCode).toBe(200);
    expect(String(file.headers['content-type'])).toContain('image/png');
    expect(String(file.headers['cache-control'])).toContain('private');
    expect(file.rawPayload.length).toBeGreaterThan(0);

    // Project scoping only: a different project cannot read the asset (404).
    const other = await createProject('Content Images Other');
    expect((await call('GET', `/projects/${other}/content/images/${image.id}/file`)).statusCode).toBe(404);

    // Generate (usage recorded), then reload: the previous uploaded image is kept.
    imageProvider.configured = true;
    const generated = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/generate`, {
      prompt: 'A conceptual illustration',
      altText: 'Generated cover',
    });
    expect(generated.statusCode).toBe(201);
    const generatedImage = generated.json();
    expect(generatedImage.kind).toBe('generated');
    expect(generatedImage.provider).toBe('stub-image');
    expect(generatedImage.model).toBe('stub-image-model');
    expect(generatedImage.usage).toEqual({ stub: true });
    expect(generatedImage.prompt).toBe('A conceptual illustration');
    imageProvider.configured = false;

    const afterGenerate = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}/images`)).json() as Array<{ id: string; version: number }>;
    expect(afterGenerate).toHaveLength(2);
    expect(afterGenerate.map((item) => item.version).sort()).toEqual([1, 2]);
    expect(afterGenerate.some((item) => item.id === image.id)).toBe(true);

    // Editable prompt: PATCH persists and survives a reload.
    const newPrompt = 'A revised conceptual illustration';
    await call('PATCH', `/projects/${projectId}/content/images/${generatedImage.id}`, { prompt: newPrompt });
    const afterPrompt = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}/images`)).json() as Array<{ id: string; prompt: string | null }>;
    expect(afterPrompt.find((item) => item.id === generatedImage.id)?.prompt).toBe(newPrompt);

    await call('POST', `/projects/${projectId}/archive`);
    expect(
      (await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/upload`, {
        dataBase64: PNG_1X1,
        fileName: 'x.png',
        mimeType: 'image/png',
      })).statusCode,
    ).toBe(400);
  });

  const makeBareDraft = async (projectId: string): Promise<string> => {
    const topic = await prisma.contentTopic.create({
      data: { projectId, title: 'Image prompt topic', audience: 'A', objective: 'O', angle: 'Angle' },
    });
    const draft = await prisma.articleDraft.create({
      data: { projectId, topicId: topic.id, bodyMarkdown: '# Body' },
    });
    return draft.id;
  };

  it('rejects an over-length prompt with actionable feedback and records no attempt', async () => {
    const projectId = await createProject('Content Prompt Limit');
    const draftId = await makeBareDraft(projectId);
    imageProvider.configured = true;
    const before = imageProvider.calls;

    const res = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/generate`, {
      prompt: 'a'.repeat(3000),
    });
    expect(res.statusCode).toBe(400);
    expect(String(res.json().message)).toMatch(/2048/);
    expect(imageProvider.calls).toBe(before);
    expect((await call('GET', `/projects/${projectId}/content/drafts/${draftId}/images`)).json()).toHaveLength(0);
    imageProvider.configured = false;
  });

  it('stores the detected format (JPEG bytes), not the provider hint', async () => {
    const projectId = await createProject('Content Format Detection');
    const draftId = await makeBareDraft(projectId);
    imageProvider.configured = true;
    imageProvider.jpeg = true;

    const res = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/generate`, {
      prompt: 'A conceptual illustration',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().mimeType).toBe('image/jpeg');
    expect(res.json().fileName).toBe('cover-v1.jpg');
    imageProvider.jpeg = false;
    imageProvider.configured = false;
  });

  it('prevents duplicate cover generation from repeated clicks', async () => {
    const projectId = await createProject('Content Duplicate Generation');
    const draftId = await makeBareDraft(projectId);
    imageProvider.configured = true;
    imageProvider.hold = true;

    const first = call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/generate`, {
      prompt: 'A conceptual illustration',
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const second = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/generate`, {
      prompt: 'A conceptual illustration',
    });
    expect(second.statusCode).toBe(409);

    imageProvider.hold = false;
    imageProvider.release?.();
    expect((await first).statusCode).toBe(201);

    // After completion the guard clears and generation works again.
    const third = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/generate`, {
      prompt: 'A conceptual illustration',
    });
    expect(third.statusCode).toBe(201);
    imageProvider.configured = false;
  });

  it('maps a server-side provider credential failure to an unavailable-provider 503, not a 400', async () => {
    const projectId = await createProject('Content Auth Failure');
    const draftId = await makeBareDraft(projectId);
    imageProvider.configured = true;
    imageProvider.authFailure = true;

    const res = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/generate`, {
      prompt: 'A conceptual illustration',
    });
    expect(res.statusCode).toBe(503);
    expect(String(res.json().message)).toMatch(/credential/i);

    const images = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}/images`)).json() as Array<{
      status: string;
    }>;
    expect(images).toHaveLength(1);
    expect(images[0]?.status).toBe('failed');

    imageProvider.authFailure = false;
    imageProvider.configured = false;
  });

  // --- Gap resolution (TASK-0015, ADR-0010, ADR-0011) ----------------------

  const resetStubs = () => {
    provider.article = null;
    provider.fail = false;
    provider.extraTopics = 0;
    research.pages = [{ ...DEFAULT_PAGE }];
    research.failures = [];
    linkSource.urls = ['https://example.com/wholesale', 'https://example.com/contacts'];
  };

  const startDraft = async (projectId: string, topicId: string) =>
    waitForRun(projectId, (await call('POST', `/projects/${projectId}/content/topics/${topicId}/draft`)).json().id as string);

  const makeTopic = async (projectId: string, title: string) =>
    (await call('POST', `/projects/${projectId}/content/topics`, {
      title,
      audience: 'A',
      objective: 'O',
      angle: 'Angle',
    })).json();

  it('produces a draft and a gap digest when the operator answers nothing at all', async () => {
    resetStubs();
    const projectId = await createProject('Gaps Unanswered');
    // The realistic path: generated topics carry open questions, and the
    // operator answers none of them.
    await waitForRun(projectId, (await call('POST', `/projects/${projectId}/content/topics/generate`)).json().id as string);
    const topic = (await call('GET', `/projects/${projectId}/content/topics`)).json()[0] as {
      id: string;
      requirements: Array<{ state: string }>;
    };
    expect(topic.requirements.length).toBeGreaterThan(0);
    expect(topic.requirements.every((item) => item.state === 'unanswered')).toBe(true);

    // Criterion 8: nothing requires an answer before generating.
    const started = await call('POST', `/projects/${projectId}/content/topics/${topic.id}/draft`);
    expect(started.statusCode).toBe(201);
    const run = await waitForRun(projectId, started.json().id as string);

    // Criterion 1: a persisted draft, with no operator answers.
    expect(run.status).toBe('completed');
    const draftId = (run.result as { draftId: string }).draftId;

    // Criterion 6: the digest is tied to the run and to the draft version.
    expect(run.gapDigest).not.toBeNull();
    expect(run.gapDigest.runId).toBe(run.id);
    expect(run.gapDigest.draftId).toBe(draftId);
    expect(run.gapDigest.draftVersion).toBe(1);
    expect(run.gapDigest.counts.total).toBe(topic.requirements.length);
    expect(run.gapDigest.counts.unresolved).toBe(topic.requirements.length);

    // Criterion 6: it survives a reload and stays with the draft.
    const draft = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}`)).json();
    expect(draft.gapDigest.runId).toBe(run.id);
    expect(draft.gapDigest.draftVersion).toBe(1);
    expect(draft.bodyMarkdown).toContain('Heading');

    // Criterion 6: the list view carries it as well.
    const fromList = ((await call('GET', `/projects/${projectId}/content/drafts`)).json() as Array<{
      id: string;
      gapDigest: { runId: string } | null;
    }>).find((item) => item.id === draftId);
    expect(fromList?.gapDigest?.runId).toBe(run.id);
  });

  it('records research provenance and honours an operator answer and exclusion', async () => {
    resetStubs();
    const projectId = await createProject('Gaps Researched');
    const topic = await makeTopic(projectId, 'Evidence topic');
    await call('PUT', `/projects/${projectId}/content/topics/${topic.id}/brief`, {
      answers: [
        { id: 'r1', question: 'Does the service cover Vilnius?', answer: null, sourceUrl: null, state: 'unanswered' },
        { id: 'r2', question: 'Can you collect batteries?', answer: 'Yes, on request.', sourceUrl: 'https://example.com/batteries', state: 'answered' },
        { id: 'r3', question: 'Are you ISO certified?', answer: null, sourceUrl: null, state: 'exclude' },
      ],
    });
    research.pages = [
      { source: 'website' as const, url: 'https://example.com/coverage', title: 'Coverage', fetchedAt: '2026-02-02T00:00:00.000Z', excerpt: 'We cover Vilnius.' },
    ];
    provider.article = {
      ...DEFAULT_ARTICLE,
      gapResolutions: [
        { requirementId: 'r1', action: 'researched', rationale: 'The coverage page lists Vilnius.', evidenceUrls: ['https://example.com/coverage'] },
        { requirementId: 'r2', action: 'researched', rationale: 'Claimed without a retrieved source.', evidenceUrls: ['https://example.com/not-retrieved'] },
        { requirementId: 'r3', action: 'neutral', rationale: 'The model tried to override the operator.', evidenceUrls: [] },
      ],
    };

    const run = await startDraft(projectId, topic.id);
    expect(run.status).toBe('completed');
    const byId = new Map<string, Record<string, never>>(
      (run.gapDigest.records as Array<{ requirementId: string }>).map((item) => [item.requirementId, item as never]),
    );
    const record = (id: string) => byId.get(id) as unknown as {
      action: string;
      operatorAnswer: string | null;
      operatorSourceUrl: string | null;
      evidence: Array<{ url: string; retrievedAt?: string }>;
    };

    // Criterion 2: a researched resolution with real provenance.
    expect(record('r1').action).toBe('researched');
    expect(record('r1').evidence).toHaveLength(1);
    expect(record('r1').evidence[0]?.url).toBe('https://example.com/coverage');
    expect(record('r1').evidence[0]?.retrievedAt).toBe('2026-02-02T00:00:00.000Z');

    // Criterion 5: the operator's answer wins, and an unretrieved URL is never
    // presented as verified evidence.
    expect(record('r2').action).toBe('operator_answer');
    expect(record('r2').operatorAnswer).toBe('Yes, on request.');
    expect(record('r2').operatorSourceUrl).toBe('https://example.com/batteries');

    // Criterion 5: the exclusion holds even when the model reports otherwise.
    expect(record('r3').action).toBe('excluded');
  });

  it('completes with supported content when research cannot resolve anything', async () => {
    resetStubs();
    const projectId = await createProject('Gaps Inconclusive');
    const topic = await makeTopic(projectId, 'Inconclusive topic');
    await call('PUT', `/projects/${projectId}/content/topics/${topic.id}/brief`, {
      answers: [
        { id: 'r1', question: 'What is the exact tonnage?', answer: null, sourceUrl: null, state: 'unknown' },
        { id: 'r2', question: 'Do you serve councils?', answer: null, sourceUrl: null, state: 'unanswered' },
      ],
    });
    // Every source is unreachable and no page is retrieved at all.
    research.pages = [];
    research.failures = [{ source: 'website' as const, url: 'https://example.com', reason: 'Fetch failed.' }];
    provider.article = { ...DEFAULT_ARTICLE, bodyMarkdown: '# Heading\n\nBody without the missing facts.' };

    const run = await startDraft(projectId, topic.id);

    // Criterion 3: an inaccessible source is not a blocking question.
    expect(run.status).toBe('completed');
    expect(run.gapDigest.counts.unresolved).toBe(2);
    expect(run.gapDigest.budget.usedPages).toBe(0);
    expect(run.gapDigest.records.every((item: { action: string }) => item.action === 'unresolved')).toBe(true);

    const draft = (await call('GET', `/projects/${projectId}/content/drafts/${(run.result as { draftId: string }).draftId}`)).json();
    expect(draft.bodyMarkdown).toContain('Body without the missing facts');
    expect(draft.status).toBe('draft');
  });

  it('neutralizes unsupported claims in every field and records them in the digest', async () => {
    resetStubs();
    const projectId = await createProject('Gaps Claims');
    const topic = await makeTopic(projectId, 'Claims topic');

    // Criterion 4: a certification and a zero-landfill claim must not survive
    // as affirmative statements, in the body or in the presentation fields.
    provider.article = {
      ...DEFAULT_ARTICLE,
      title: 'Zero Landfill promise',
      callToAction: 'Get guaranteed results',
      bodyMarkdown: '# Heading\n\nWe are certified and run a zero landfill service.',
    };

    const run = await startDraft(projectId, topic.id);
    expect(run.status).toBe('completed');
    const draft = (await call('GET', `/projects/${projectId}/content/drafts/${(run.result as { draftId: string }).draftId}`)).json();

    expect(draft.title).not.toMatch(/zero[-\s]?landfill/i);
    expect(draft.callToAction).not.toMatch(/guaranteed/i);
    expect(draft.bodyMarkdown).not.toMatch(/zero[-\s]?landfill|certified/i);

    const fields = (run.gapDigest.neutralizedClaims as Array<{ field: string }>).map((item) => item.field);
    expect(fields).toContain('bodyMarkdown');
    expect(fields).toContain('title');
  });

  it('keeps each version and its own digest when regenerating', async () => {
    resetStubs();
    const projectId = await createProject('Gaps Regen');
    const topic = await makeTopic(projectId, 'Gap regen topic');
    await call('PUT', `/projects/${projectId}/content/topics/${topic.id}/brief`, {
      answers: [{ id: 'r1', question: 'Open question', answer: null, sourceUrl: null, state: 'unanswered' }],
    });

    const first = await startDraft(projectId, topic.id);
    const second = await startDraft(projectId, topic.id);
    expect((first.result as { version: number }).version).toBe(1);
    expect((second.result as { version: number }).version).toBe(2);

    // Criterion 7: regeneration preserves the previous version and its history.
    const firstDraft = (await call('GET', `/projects/${projectId}/content/drafts/${(first.result as { draftId: string }).draftId}`)).json();
    const secondDraft = (await call('GET', `/projects/${projectId}/content/drafts/${(second.result as { draftId: string }).draftId}`)).json();
    expect(firstDraft.gapDigest.runId).toBe(first.id);
    expect(secondDraft.gapDigest.runId).toBe(second.id);
    expect(firstDraft.gapDigest.runId).not.toBe(secondDraft.gapDigest.runId);
    expect(firstDraft.gapDigest.draftVersion).toBe(1);
    expect(secondDraft.gapDigest.draftVersion).toBe(2);
  });

  it('still fails truthfully when the model output is unusable', async () => {
    resetStubs();
    const projectId = await createProject('Gaps Malformed');
    const topic = await makeTopic(projectId, 'Malformed topic');
    provider.article = { title: 'Incomplete output' };

    const run = await startDraft(projectId, topic.id);

    // Criterion 10: removing the information gates must not turn a technical
    // failure into a fake success.
    expect(run.status).toBe('failed');
    expect(run.error).toBeTruthy();
    expect(run.gapDigest).toBeNull();
    expect(run.result).toBeNull();

    const drafts = (await call('GET', `/projects/${projectId}/content/drafts`)).json() as Array<{ topicId: string }>;
    expect(drafts.filter((item) => item.topicId === topic.id)).toHaveLength(0);
  });

  // --- Link planning (TASK-0016, ROADMAP-05) -------------------------------

  it('keeps only justified links and records the ones it removed', async () => {
    resetStubs();
    const projectId = await createProject('Links Policy');
    const topic = await makeTopic(projectId, 'Links topic');
    research.pages = [
      { ...DEFAULT_PAGE },
      {
        source: 'competitor' as const,
        url: 'https://wrap.test/textiles',
        title: 'WRAP textiles',
        fetchedAt: '2026-03-03T00:00:00.000Z',
        excerpt: 'Reuse is growing.',
      },
    ];
    provider.article = {
      ...DEFAULT_ARTICLE,
      bodyMarkdown: [
        '# Heading',
        '',
        'See our [wholesale service](/wholesale) for bulk orders.',
        '',
        'We also list an [invented page](/does-not-exist).',
        '',
        'According to [WRAP](https://wrap.test/textiles) reuse is growing.',
        '',
        'And per [a study](https://invented.test/study) it doubles every year.',
      ].join('\n'),
    };

    const run = await startDraft(projectId, topic.id);
    expect(run.status).toBe('completed');
    const draftId = (run.result as { draftId: string }).draftId;
    const draft = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}`)).json();

    // The allowed internal page and the retrieved external source survive.
    expect(draft.bodyMarkdown).toContain('](/wholesale)');
    expect(draft.bodyMarkdown).toContain('](https://wrap.test/textiles)');
    // The invented ones lose the link but keep the sentence readable.
    expect(draft.bodyMarkdown).not.toContain('/does-not-exist)');
    expect(draft.bodyMarkdown).not.toContain('https://invented.test/study');
    expect(draft.bodyMarkdown).toContain('invented page');
    expect(draft.bodyMarkdown).toContain('a study');

    expect(run.linkPlan.source).toBe('sitemap');
    expect(run.linkPlan.internal.map((entry: { url: string }) => entry.url)).toEqual(['/wholesale']);
    expect(run.linkPlan.external.map((entry: { url: string }) => entry.url)).toEqual(['https://wrap.test/textiles']);
    expect(run.linkPlan.dropped).toHaveLength(2);
    expect(
      run.linkPlan.dropped.every((entry: { reason: string }) => entry.reason.length > 0),
    ).toBe(true);

    // The draft view carries the same record, so it survives a reload.
    expect(draft.linkPlan.internal).toHaveLength(1);
    expect(draft.linkPlan.external).toHaveLength(1);
  });

  it('places no internal links when the project has no URL list at all', async () => {
    resetStubs();
    const projectId = await createProject('Links Empty');
    const topic = await makeTopic(projectId, 'No list topic');
    linkSource.urls = [];
    research.pages = [];
    research.failures = [{ source: 'website' as const, url: 'https://example.com', reason: 'Fetch failed.' }];
    provider.article = { ...DEFAULT_ARTICLE, bodyMarkdown: '# Heading\n\nSee [contacts](/contacts) for details.' };

    const run = await startDraft(projectId, topic.id);
    expect(run.status).toBe('completed');
    const draft = (await call('GET', `/projects/${projectId}/content/drafts/${(run.result as { draftId: string }).draftId}`)).json();

    expect(draft.bodyMarkdown).not.toContain('](');
    expect(draft.bodyMarkdown).toContain('contacts');
    expect(run.linkPlan.source).toBe('none');
    expect(run.linkPlan.candidates).toBe(0);
    expect(run.linkPlan.dropped).toHaveLength(1);
  });

  it('falls back to the pages the research already retrieved', async () => {
    resetStubs();
    const projectId = await createProject('Links Fallback');
    const topic = await makeTopic(projectId, 'Fallback topic');
    linkSource.urls = [];
    research.pages = [
      {
        source: 'website' as const,
        url: 'https://example.com/collection',
        title: 'Collection',
        fetchedAt: '2026-03-04T00:00:00.000Z',
        excerpt: 'Where to bring textiles.',
      },
    ];
    provider.article = { ...DEFAULT_ARTICLE, bodyMarkdown: '# Heading\n\nFind a [collection point](/collection).' };

    const run = await startDraft(projectId, topic.id);
    const draft = (await call('GET', `/projects/${projectId}/content/drafts/${(run.result as { draftId: string }).draftId}`)).json();

    expect(run.linkPlan.source).toBe('research');
    expect(run.linkPlan.internal.map((entry: { url: string }) => entry.url)).toEqual(['/collection']);
    expect(draft.bodyMarkdown).toContain('](/collection)');
  });
});
