import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../database/index.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reports the database up when the probe succeeds', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;

    const service = new HealthService(prisma);
    await expect(service.check()).resolves.toMatchObject({ status: 'ok', database: 'up' });
  });

  it('reports the database down without leaking connection details', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('connection refused to 127.0.0.1:5432')),
    } as unknown as PrismaService;

    const service = new HealthService(prisma);
    const result = await service.check();

    expect(result).toMatchObject({ status: 'error', database: 'down' });
    expect(JSON.stringify(result)).not.toContain('127.0.0.1');
  });
});
