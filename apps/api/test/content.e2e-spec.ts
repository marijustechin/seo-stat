import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { FastifyInstance } from 'fastify';
import { mkdtemp, rm } from 'node:fs/promises';
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
import { ImageProvider } from '../src/modules/content/image.provider.js';

// A 1x1 PNG (valid signature + IHDR), used to exercise upload and generation paths.
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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

class StubProvider extends AnalysisProvider {
  readonly providerId = 'stub';
  readonly model = 'stub-model';
  configured = true;
  fail = false;
  extraTopics = 0;

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
      output: {
        title: 'Reuse and Zero Landfill Explained',
        excerpt: 'Short excerpt.',
        bodyMarkdown: '# Heading\n\nBody text.',
        slug: 'generated-title',
        seoTitle: 'SEO title',
        metaDescription: 'Meta description.',
        callToAction: 'Contact us',
        sources: [{ url: 'https://example.com', note: 'home' }],
        unresolvedClaims: ['Confirm collection coverage'],
      },
      inputTokens: 200,
      outputTokens: 100,
    };
  }
}

class StubResearch extends AnalysisResearch {
  async collect() {
    return {
      pages: [{ source: 'website' as const, url: 'https://example.com', title: 'Home', fetchedAt: '2026-01-01T00:00:00.000Z', excerpt: 'We collect textiles.' }],
      failures: [],
      websiteReadable: true,
      backend: 'direct' as const,
      firecrawlCredits: null,
    };
  }
}

class StubImageProvider extends ImageProvider {
  readonly providerId = 'stub-image';
  readonly model = 'stub-image-model';
  configured = false;
  calls = 0;

  isConfigured(): boolean {
    return this.configured;
  }

  async generate() {
    this.calls += 1;
    return { base64: PNG_1X1, mimeType: 'image/png', usage: { stub: true } };
  }
}

describe('Content (integration, mocked provider)', () => {
  let app: NestFastifyApplication;
  let server: FastifyInstance;
  let prisma: PrismaService;
  let runner: ContentRunner;
  const provider = new StubProvider();
  const imageProvider = new StubImageProvider();
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
      .useValue(new StubResearch())
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

  it('manages cover images: upload, alt, select, serve, isolation, archived state', async () => {
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

    const list = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}/images`)).json() as Array<{ id: string; selected: boolean }>;
    expect(list).toHaveLength(1);

    await call('POST', `/projects/${projectId}/content/images/${image.id}/select`);
    const selected = (await call('GET', `/projects/${projectId}/content/drafts/${draftId}/images`)).json() as Array<{ id: string; selected: boolean }>;
    expect(selected.find((item) => item.id === image.id)?.selected).toBe(true);

    const patched = await call('PATCH', `/projects/${projectId}/content/images/${image.id}`, { altText: 'Updated alt' });
    expect(patched.json().altText).toBe('Updated alt');

    const file = await call('GET', `/projects/${projectId}/content/images/${image.id}/file`);
    expect(file.statusCode).toBe(200);
    expect(String(file.headers['content-type'])).toContain('image/png');
    expect(file.rawPayload.length).toBeGreaterThan(0);

    const other = await createProject('Content Images Other');
    expect((await call('GET', `/projects/${other}/content/images/${image.id}/file`)).statusCode).toBe(404);

    imageProvider.configured = true;
    const generated = await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/generate`, {
      prompt: 'A conceptual illustration',
      altText: 'Generated cover',
    });
    expect(generated.statusCode).toBe(201);
    expect(generated.json().kind).toBe('generated');
    imageProvider.configured = false;

    await call('POST', `/projects/${projectId}/archive`);
    expect(
      (await call('POST', `/projects/${projectId}/content/drafts/${draftId}/images/upload`, {
        dataBase64: PNG_1X1,
        fileName: 'x.png',
        mimeType: 'image/png',
      })).statusCode,
    ).toBe(400);
  });
});
