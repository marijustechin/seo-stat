import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError, apiFetch } from './client';

/**
 * Regression: the shared API helper must not send a JSON Content-Type on a
 * bodyless request, because Fastify rejects an empty body that declares
 * `application/json`. This exercises the actual helper against a real Fastify
 * server (the same framework the API uses).
 */
describe('apiFetch request contract (against Fastify)', () => {
  let app: FastifyInstance;
  let base: string;

  beforeAll(async () => {
    app = Fastify();
    app.post('/seo-stat/api/projects/:id/analysis', async (_request, reply) =>
      reply.code(201).send({ id: 'run-1', status: 'queued' }),
    );
    app.post('/seo-stat/api/projects/:id/archive', async (request, reply) =>
      reply.code(201).send({ id: (request.params as { id: string }).id, status: 'archived' }),
    );
    app.post('/seo-stat/api/echo', async (request, reply) =>
      reply.code(201).send({
        body: request.body ?? null,
        contentType: request.headers['content-type'] ?? null,
      }),
    );
    app.get('/seo-stat/api/ping', async (_request, reply) => reply.code(200).send({ ok: true }));

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('no server address');
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts a bodyless POST (analysis) without a JSON Content-Type', async () => {
    const result = await apiFetch<{ id: string }>('/projects/p1/analysis', { method: 'POST' }, base);
    expect(result.id).toBe('run-1');
  });

  it('performs other bodyless actions (archive) without a JSON Content-Type', async () => {
    const result = await apiFetch<{ status: string }>('/projects/p1/archive', { method: 'POST' }, base);
    expect(result.status).toBe('archived');
  });

  it('sends the JSON Content-Type and body when a body is present', async () => {
    const result = await apiFetch<{ body: unknown; contentType: string | null }>(
      '/echo',
      { method: 'POST', body: JSON.stringify({ hello: 'world' }) },
      base,
    );
    expect(result.contentType).toContain('application/json');
    expect(result.body).toEqual({ hello: 'world' });
  });

  it('does not send a JSON Content-Type for GET requests', async () => {
    const result = await apiFetch<{ ok: boolean }>('/ping', {}, base);
    expect(result.ok).toBe(true);
  });

  it('documents the defect: an empty body with application/json is rejected', async () => {
    await expect(
      apiFetch(
        '/projects/p1/analysis',
        { method: 'POST', headers: { 'content-type': 'application/json' } },
        base,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
