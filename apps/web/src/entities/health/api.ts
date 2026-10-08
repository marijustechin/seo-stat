import { apiUrl } from '@/shared/config/app';
import type { HealthProbe, HealthStatus } from './model';

export async function probeHealth(): Promise<HealthProbe> {
  try {
    const res = await fetch(apiUrl('/health'), { cache: 'no-store' });
    const body = (await res.json().catch(() => null)) as HealthStatus | null;
    if (res.ok && body?.status === 'ok' && body.database) {
      return { kind: 'ok', database: body.database, timestamp: body.timestamp ?? '' };
    }
    if (body?.database) {
      return { kind: 'degraded', database: body.database };
    }
    return { kind: 'unreachable' };
  } catch {
    return { kind: 'unreachable' };
  }
}
