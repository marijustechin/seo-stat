import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { PrismaService } from '../src/database/index.js';
import { AnalysisRunner } from '../src/modules/analysis/analysis.runner.js';
import {
  AnalysisProvider,
  type AnalysisModelResult,
} from '../src/modules/analysis/ai/ai-provider.js';
import { AnalysisResearch } from '../src/modules/analysis/research/research.service.js';

const OUTPUT = {
  businessContext: {
    value: 'Textile reuse for UK brands and councils.',
    origin: 'website',
    confidence: 'medium',
    sources: [{ url: 'https://example.com', note: 'home' }],
    rationale: 'Derived from the website.',
  },
  audienceSegments: [
    {
      name: 'Brands and retailers',
      needs: 'Handle unsold collections',
      offering: 'Collection and reuse',
      desiredAction: 'Request an agreement',
      contentDirections: ['case studies'],
      origin: 'user',
      confidence: 'high',
      sources: [],
    },
    {
      name: 'Residents',
      needs: 'Easy textile recycling',
      offering: 'Local collection',
      desiredAction: 'Book a collection',
      contentDirections: ['local pages'],
      origin: 'inference',
      confidence: 'medium',
      sources: [],
    },
  ],
  objectives: {
    value: 'Win brand and council partnerships and grow resident collections.',
    origin: 'user',
    confidence: 'high',
    sources: [],
    rationale: 'Clarifies the stated objectives.',
  },
  tone: {
    value: 'Practical and trustworthy',
    origin: 'inference',
    confidence: 'medium',
    sources: [],
    rationale: 'Matches the sector.',
  },
  contentThemes: [
    { theme: 'Circular textile economy', rationale: 'Core topic', origin: 'inference', sources: [] },
  ],
  missingInformation: [{ question: 'Which regions do you cover?', why: 'Affects audience targeting.' }],
};

class StubProvider extends AnalysisProvider {
  readonly providerId = 'stub';
  readonly model = 'stub-model';
  configured = true;

  isConfigured(): boolean {
    return this.configured;
  }

  async analyze(): Promise<AnalysisModelResult> {
    // Small delay so the run stays active long enough to test duplicate prevention.
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { output: OUTPUT, inputTokens: 123, outputTokens: 45 };
  }
}

class StubResearch extends AnalysisResearch {
  async collect() {
    return {
      pages: [
        {
          source: 'website' as const,
          url: 'https://example.com',
          title: 'Home',
          fetchedAt: new Date().toISOString(),
          excerpt: 'We collect used textiles.',
        },
      ],
      failures: [],
      websiteReadable: true,
    };
  }
}

describe('Analysis (integration, mocked provider)', () => {
  let app: NestFastifyApplication;
  let server: FastifyInstance;
  let prisma: PrismaService;
  let runner: AnalysisRunner;
  const provider = new StubProvider();
  const created: string[] = [];

  const call = (
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    payload?: Record<string, unknown>,
  ) => server.inject({ method, url: `/seo-stat/api${url}`, ...(payload ? { payload } : {}) });

  const createProject = async (name: string): Promise<string> => {
    const res = await call('POST', '/projects', {
      name,
      websiteUrl: 'https://example.com',
      competitorUrls: ['https://competitor.example'],
    });
    const id = res.json().id as string;
    created.push(id);
    return id;
  };

  const waitForRun = async (projectId: string, runId: string, timeoutMs = 10_000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await call('GET', `/projects/${projectId}/analysis/${runId}`);
      const body = res.json();
      if (body.status === 'completed' || body.status === 'failed') return body;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('analysis did not finish in time');
  };

  const startAndWait = async (projectId: string, timeoutMs = 10_000) => {
    const started = await call('POST', `/projects/${projectId}/analysis`);
    expect(started.statusCode).toBe(201);
    return waitForRun(projectId, started.json().id as string, timeoutMs);
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
    runner = app.get(AnalysisRunner);
  });

  afterAll(async () => {
    if (created.length > 0) {
      await prisma.project.deleteMany({ where: { id: { in: created } } });
    }
    await app.close();
  });

  it('runs an analysis, records usage/model, and cannot run twice concurrently', async () => {
    const projectId = await createProject('Analysis A');
    const started = await call('POST', `/projects/${projectId}/analysis`);
    expect(started.statusCode).toBe(201);

    const duplicate = await call('POST', `/projects/${projectId}/analysis`);
    expect(duplicate.statusCode).toBe(409);

    const run = await waitForRun(projectId, started.json().id as string);
    expect(run.status).toBe('completed');
    expect(run.model).toBe('stub-model');
    expect(run.inputTokens).toBe(123);
    expect(run.outputTokens).toBe(45);
    expect(run.estimatedCostUsd).toBeNull();
    expect(run.result.audienceSegments.length).toBeGreaterThanOrEqual(2);
    expect(run.evidence.websiteReadable).toBe(true);
  });

  it('starts and completes an analysis with zero competitors', async () => {
    const res = await call('POST', '/projects', { name: 'Analysis No Competitors' });
    const projectId = res.json().id as string;
    created.push(projectId);
    const run = await startAndWait(projectId);
    expect(run.status).toBe('completed');
    expect(run.inputSnapshot.competitorUrls).toEqual([]);
  });

  it('applies only the selected fields and never changes the publishing policy', async () => {
    const projectId = await createProject('Analysis Apply');
    const run = await startAndWait(projectId);
    const applied = await call('POST', `/projects/${projectId}/analysis/${run.id}/apply`, {
      businessContext: true,
      objectives: true,
      businessContextValue: 'Edited context',
      objectivesValue: 'Edited objectives',
    });
    expect(applied.statusCode).toBe(201);

    const project = (await call('GET', `/projects/${projectId}`)).json();
    expect(project.businessContext).toBe('Edited context');
    expect(project.objectives).toBe('Edited objectives');
    expect(project.tone).toBeNull();
    expect(project.publishingPolicy).toBe('review');
    expect(applied.json().appliedFields).toEqual(['businessContext', 'objectives']);
  });

  it('detects changed settings and requires acknowledgement before applying', async () => {
    const projectId = await createProject('Analysis Conflict');
    const run = await startAndWait(projectId);

    await call('PATCH', `/projects/${projectId}/settings`, { tone: 'changed after start' });

    const blocked = await call('POST', `/projects/${projectId}/analysis/${run.id}/apply`, {
      businessContext: true,
    });
    expect(blocked.statusCode).toBe(409);

    const forced = await call('POST', `/projects/${projectId}/analysis/${run.id}/apply`, {
      businessContext: true,
      acknowledgeConflict: true,
    });
    expect(forced.statusCode).toBe(201);
  });

  it('rejects analyses and applications for archived projects', async () => {
    const projectId = await createProject('Analysis Archived');
    const run = await startAndWait(projectId);
    await call('POST', `/projects/${projectId}/archive`);

    const start = await call('POST', `/projects/${projectId}/analysis`);
    expect(start.statusCode).toBe(409);
    const apply = await call('POST', `/projects/${projectId}/analysis/${run.id}/apply`, {
      businessContext: true,
    });
    expect(apply.statusCode).toBe(409);
  });

  it('keeps projects isolated', async () => {
    const a = await createProject('Analysis Iso A');
    const b = await createProject('Analysis Iso B');
    const runA = await startAndWait(a);
    const cross = await call('GET', `/projects/${b}/analysis/${runA.id}`);
    expect(cross.statusCode).toBe(404);
  });

  it('reports an unavailable state when the provider is not configured', async () => {
    const projectId = await createProject('Analysis Unconfigured');
    provider.configured = false;
    const res = await call('POST', `/projects/${projectId}/analysis`);
    expect(res.statusCode).toBe(503);
    provider.configured = true;
  });

  it('marks stale running runs as interrupted on startup', async () => {
    const projectId = await createProject('Analysis Interrupted');
    const stale = await prisma.analysisRun.create({
      data: { projectId, status: 'running', inputSnapshot: { websiteUrl: null } },
    });
    await runner.onModuleInit();
    const res = await call('GET', `/projects/${projectId}/analysis/${stale.id}`);
    expect(res.json().status).toBe('interrupted');
  });
});
