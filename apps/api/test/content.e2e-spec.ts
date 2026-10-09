import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { FastifyInstance } from 'fastify';
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

describe('Content (integration, mocked provider)', () => {
  let app: NestFastifyApplication;
  let server: FastifyInstance;
  let prisma: PrismaService;
  let runner: ContentRunner;
  const provider = new StubProvider();
  const created: string[] = [];

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, payload?: Record<string, unknown>) =>
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
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AnalysisProvider)
      .useValue(provider)
      .overrideProvider(AnalysisResearch)
      .useValue(new StubResearch())
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
});
