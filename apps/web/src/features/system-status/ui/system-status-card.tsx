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
      <h2 id="analysis-status-title">Analysis configuration</h2>
      {state.kind === 'loading' && <p role="status">Checking configuration…</p>}
      {state.kind === 'error' && (
        <p className="status-error" role="alert">
          Could not read the system status.
        </p>
      )}
      {state.kind === 'ready' && (
        <>
          <h3>AI analysis provider</h3>
          <p>
            Provider: <strong>{state.status.analysis.provider}</strong> · model{' '}
            <strong>{state.status.analysis.model}</strong>
          </p>
          {state.status.analysis.configured ? (
            <p className="status-ok" role="status">
              DeepSeek is configured. Analysis and suggestions are available.
            </p>
          ) : (
            <p className="status-error" role="status">
              DeepSeek is not configured, so analysis is unavailable. An administrator must set
              DEEPSEEK_API_KEY on the server. Credentials are server-side only and never exposed
              here.
            </p>
          )}

          <h3>Research backend</h3>
          {state.status.analysis.research.firecrawl.configured ? (
            <p className="status-ok" role="status">
              Firecrawl is configured and is used to acquire page content (preferred).
            </p>
          ) : (
            <p role="status">
              Firecrawl is not configured; the direct fetch backend is used to acquire content.
            </p>
          )}

          <h3>Cover image provider</h3>
          <p>
            Provider: <strong>{state.status.image.provider}</strong> · model{' '}
            <strong>{state.status.image.model}</strong>
          </p>
          {state.status.image.configured ? (
            <p className="status-ok" role="status">
              Image generation is configured. Covers can be generated; uploads always work.
            </p>
          ) : (
            <p role="status">
              Image generation is not configured, so covers can only be uploaded. An administrator can
              set IMAGE_API_KEY on the server.
            </p>
          )}

          <h3>External integrations</h3>
          {state.status.integrations.encryptionConfigured ? (
            <p className="status-ok" role="status">
              Credential encryption is configured. WordPress connections can be stored securely.
            </p>
          ) : (
            <p role="status">
              Credential encryption is not configured, so integration credentials cannot be stored. An
              administrator must provide the integration encryption key.
            </p>
          )}
        </>
      )}
    </section>
  );
}
