'use client';

import { useCallback, useEffect, useState } from 'react';
import { listAnalyses } from '@/entities/analysis/api';
import { listContentRuns } from '@/entities/content/api';
import { useProject } from '@/widgets/project-workspace/project-context';

interface Entry {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  model: string | null;
  usage: string;
  cost: string;
  detail: string | null;
}

function usage(input: number | null, output: number | null): string {
  return input === null ? '—' : `${input} in / ${output ?? 0} out`;
}

function cost(value: number | null): string {
  return value === null ? 'cost unavailable' : `$${value.toFixed(4)}`;
}

export function ProjectRunHistory() {
  const { project } = useProject();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [analyses, content] = await Promise.all([
        listAnalyses(project.id),
        listContentRuns(project.id),
      ]);
      const merged: Entry[] = [
        ...analyses.map((run) => ({
          id: run.id,
          type: 'Website & competitor analysis',
          status: run.status,
          createdAt: run.createdAt,
          finishedAt: run.finishedAt,
          model: run.model,
          usage: usage(run.inputTokens, run.outputTokens),
          cost: cost(run.estimatedCostUsd),
          detail: run.error ?? (run.appliedAt ? `applied: ${run.appliedFields.join(', ') || 'none'}` : null),
        })),
        ...content.map((run) => ({
          id: run.id,
          type: run.kind === 'topics' ? 'Topic generation' : 'Article draft generation',
          status: run.status,
          createdAt: run.createdAt,
          finishedAt: run.finishedAt,
          model: run.model,
          usage: usage(run.inputTokens, run.outputTokens),
          cost: cost(run.estimatedCostUsd),
          detail: run.error,
        })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setEntries(merged);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run history.');
    }
  }, [project.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  return (
    <>
      <h1>Run history</h1>
      <p className="muted">Analyses, topic generation, and article draft generation for this project.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {entries && entries.length === 0 && (
        <div className="card empty">
          <p>No runs yet.</p>
        </div>
      )}
      {entries && entries.length > 0 && (
        <div className="card">
          <ul className="run-list">
            {entries.map((entry) => (
              <li key={entry.id} className="run-item">
                <div className="run-head">
                  <strong>{entry.type}</strong>
                  <span className="badge">{entry.status}</span>
                </div>
                <dl className="meta">
                  <div>
                    <dt>Started</dt>
                    <dd>{new Date(entry.createdAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Finished</dt>
                    <dd>{entry.finishedAt ? new Date(entry.finishedAt).toLocaleString() : '—'}</dd>
                  </div>
                  <div>
                    <dt>Model</dt>
                    <dd>{entry.model ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Usage</dt>
                    <dd>
                      {entry.usage} · {entry.cost}
                    </dd>
                  </div>
                  {entry.detail && (
                    <div>
                      <dt>Detail</dt>
                      <dd>{entry.detail}</dd>
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
