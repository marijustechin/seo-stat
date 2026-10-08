import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { PrismaService } from '../src/database/index.js';

type InjectResponse = Awaited<ReturnType<FastifyInstance['inject']>>;

describe('Projects (integration)', () => {
  let app: NestFastifyApplication;
  let server: FastifyInstance;
  let prisma: PrismaService;
  const created: string[] = [];

  const call = (
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    payload?: Record<string, unknown>,
  ): Promise<InjectResponse> =>
    server.inject({
      method,
      url: `/seo-stat/api${url}`,
      ...(payload === undefined ? {} : { payload }),
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ routerOptions: { ignoreTrailingSlash: true } }),
    );
    configureApp(app);
    await app.init();
    server = app.getHttpAdapter().getInstance() as FastifyInstance;
    await server.ready();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (created.length > 0) {
      await prisma.project.deleteMany({ where: { id: { in: created } } });
    }
    await app.close();
  });

  it('creates a project with the documented defaults', async () => {
    const res = await call('POST', '/projects', { name: 'Acme' });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    created.push(body.id);
    expect(body).toMatchObject({
      name: 'Acme',
      timezone: 'Europe/Vilnius',
      publishingPolicy: 'review',
      contentLanguage: 'en',
      status: 'active',
      archivedAt: null,
    });
    expect(typeof body.id).toBe('string');
  });

  it('lists active projects', async () => {
    const res = await call('GET', '/projects');
    expect(res.statusCode).toBe(200);
    const ids = res.json().map((p: { id: string }) => p.id);
    expect(ids).toContain(created[0]);
  });

  it('retrieves a project and returns 404 for an unknown id', async () => {
    const found = await call('GET', `/projects/${created[0]}`);
    expect(found.statusCode).toBe(200);
    expect(found.json().name).toBe('Acme');

    const missing = await call('GET', '/projects/does-not-exist');
    expect(missing.statusCode).toBe(404);
  });

  it('keeps identity stable when the name and website change', async () => {
    const before = await call('GET', `/projects/${created[0]}`);
    const res = await call('PATCH', `/projects/${created[0]}`, {
      name: 'Acme Renamed',
      websiteUrl: 'https://acme.example',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(before.json().id);
    expect(body.name).toBe('Acme Renamed');
    expect(body.websiteUrl).toBe('https://acme.example');
  });

  it('persists project settings', async () => {
    const res = await call('PATCH', `/projects/${created[0]}/settings`, {
      businessContext: 'B2B analytics',
      audience: 'Marketing leads',
      objectives: 'Grow organic traffic',
      tone: 'friendly',
      timezone: 'Europe/Paris',
      publishingPolicy: 'automatic',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      businessContext: 'B2B analytics',
      audience: 'Marketing leads',
      objectives: 'Grow organic traffic',
      tone: 'friendly',
      timezone: 'Europe/Paris',
      publishingPolicy: 'automatic',
    });

    const reread = await call('GET', `/projects/${created[0]}`);
    expect(reread.json().businessContext).toBe('B2B analytics');
    expect(reread.json().publishingPolicy).toBe('automatic');
  });

  it('archives and restores while preserving history', async () => {
    const archived = await call('POST', `/projects/${created[0]}/archive`);
    expect(archived.statusCode).toBe(201);
    expect(archived.json().status).toBe('archived');
    expect(archived.json().archivedAt).not.toBeNull();

    const active = await call('GET', '/projects?status=active');
    expect(active.json().map((p: { id: string }) => p.id)).not.toContain(created[0]);
    const archivedList = await call('GET', '/projects?status=archived');
    expect(archivedList.json().map((p: { id: string }) => p.id)).toContain(created[0]);

    const restored = await call('POST', `/projects/${created[0]}/restore`);
    expect(restored.json().status).toBe('active');
    expect(restored.json().archivedAt).toBeNull();
  });

  it('keeps two projects independent', async () => {
    const second = await call('POST', '/projects', { name: 'Beta', websiteUrl: 'https://beta.example' });
    const secondId = second.json().id;
    created.push(secondId);

    await call('PATCH', `/projects/${secondId}/settings`, { tone: 'formal' });

    const first = await call('GET', `/projects/${created[0]}`);
    const other = await call('GET', `/projects/${secondId}`);
    expect(first.json().id).not.toBe(other.json().id);
    expect(other.json().tone).toBe('formal');
    expect(first.json().tone).not.toBe('formal');
  });

  it('rejects invalid input', async () => {
    const noName = await call('POST', '/projects', { name: '   ' });
    expect(noName.statusCode).toBe(400);

    const badPolicy = await call('POST', '/projects', { name: 'X', publishingPolicy: 'bogus' });
    expect(badPolicy.statusCode).toBe(400);

    const badUrl = await call('POST', '/projects', { name: 'X', websiteUrl: 'not a url' });
    expect(badUrl.statusCode).toBe(400);

    const badTimezone = await call('POST', '/projects', { name: 'X', timezone: 'Mars/Phobos' });
    expect(badTimezone.statusCode).toBe(400);

    const extraField = await call('POST', '/projects', { name: 'X', unexpected: true });
    expect(extraField.statusCode).toBe(400);
  });

  it('returns 404 when updating an unknown project', async () => {
    const res = await call('PATCH', '/projects/unknown-id', { name: 'Nope' });
    expect(res.statusCode).toBe(404);
  });
});
