'use client';

import { useEffect, useState } from 'react';
import { getSystemStatus, type SystemStatus } from '@/entities/system/api';

type State = { kind: 'loading' } | { kind: 'ready'; status: SystemStatus } | { kind: 'error' };

export function SystemStatusCard() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const status = await getSystemStatus();
        if (active) setState({ kind: 'ready', status });
      } catch {
        if (active) setState({ kind: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="card" aria-labelledby="analysis-status-title">
      <h2 id="analysis-status-title">Analysis provider</h2>
      {state.kind === 'loading' && <p role="status">Checking configuration…</p>}
      {state.kind === 'error' && (
        <p className="status-error" role="alert">
          Could not read the system status.
        </p>
      )}
      {state.kind === 'ready' && (
        <>
          <p>
            Provider: <strong>{state.status.analysis.provider}</strong> · model{' '}
            <strong>{state.status.analysis.model}</strong>
          </p>
          {state.status.analysis.configured ? (
            <p className="status-ok" role="status">
              Analysis is configured. Website &amp; competitor analysis is available.
            </p>
          ) : (
            <p className="status-error" role="status">
              Analysis is not configured. Set OPENAI_API_KEY on the server to enable it. Credentials
              are server-side only and are never exposed here.
            </p>
          )}
        </>
      )}
    </section>
  );
}
