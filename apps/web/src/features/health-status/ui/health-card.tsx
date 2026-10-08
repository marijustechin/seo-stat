'use client';

import { useCallback, useEffect, useState } from 'react';
import { probeHealth } from '@/entities/health/api';
import type { HealthProbe } from '@/entities/health/model';

type HealthState = HealthProbe | { kind: 'loading' };

export function HealthCard() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState(await probeHealth());
  }, []);

  useEffect(() => {
    // Fetch the health status once on mount. The state update happens after the
    // await inside load(), so it is asynchronous rather than a synchronous
    // render during the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  const refresh = () => {
    setState({ kind: 'loading' });
    void load();
  };

  return (
    <section className="card" aria-labelledby="api-health-title">
      <h2 id="api-health-title">API health</h2>
      <p className="muted">Live check of the NestJS API and its PostgreSQL connection.</p>
      {state.kind === 'loading' && <p role="status">Checking…</p>}
      {state.kind === 'ok' && (
        <p role="status" className="status-ok">
          API is up. Database: {state.database}. Checked at {state.timestamp}.
        </p>
      )}
      {state.kind === 'degraded' && (
        <p role="status" className="status-error">
          API is running but the database is {state.database}.
        </p>
      )}
      {state.kind === 'unreachable' && (
        <p role="status" className="status-error">
          API is unreachable. Is the API service running?
        </p>
      )}
      <button type="button" className="button cursor-pointer" onClick={refresh}>
        Refresh status
      </button>
    </section>
  );
}
