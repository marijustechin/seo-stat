'use client';

import { useCallback, useEffect, useState } from 'react';
import { listAnalyses } from '@/entities/analysis/api';
import type { AnalysisRunView } from '@/entities/analysis/model';
import { useProject } from '@/widgets/project-workspace/project-context';

function cost(run: AnalysisRunView): string {
  return run.estimatedCostUsd === null ? 'cost unavailable' : `$${run.estimatedCostUsd.toFixed(4)}`;
}

export function AnalysisHistory() {
  const { project } = useProject();
  const [runs, setRuns] = useState<AnalysisRunView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRuns(await listAnalyses(project.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analyses.');
    }
  }, [project.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  return (
    <>
      <h1>Run history</h1>
      <p className="muted">
        Website &amp; competitor analyses run for this project. Workflow executions are not
        implemented yet.
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!error && runs && runs.length === 0 && (
        <div className="card empty">
          <p>No analyses yet. Start one from Settings.</p>
        </div>
      )}
      {runs && runs.length > 0 && (
        <div className="card">
          <ul className="run-list">
            {runs.map((run) => (
              <li key={run.id} className="run-item">
                <div className="run-head">
                  <strong>Website &amp; competitor analysis</strong>
                  <span className="badge">{run.status}</span>
                </div>
                <dl className="meta">
                  <div>
                    <dt>Started</dt>
                    <dd>{run.createdAt}</dd>
                  </div>
                  <div>
                    <dt>Finished</dt>
                    <dd>{run.finishedAt ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Model</dt>
                    <dd>{run.model ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Usage</dt>
                    <dd>
                      {run.inputTokens !== null
                        ? `${run.inputTokens} in / ${run.outputTokens ?? 0} out · ${cost(run)}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Applied</dt>
                    <dd>{run.appliedAt ? `${run.appliedAt} (${run.appliedFields.join(', ') || 'none'})` : 'not applied'}</dd>
                  </div>
                  {run.error && (
                    <div>
                      <dt>Error</dt>
                      <dd className="status-error">{run.error}</dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
