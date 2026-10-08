'use client';

import { useCallback, useEffect, useState } from 'react';
import { listAnalyses, startAnalysis } from '@/entities/analysis/api';
import type { AnalysisRunView } from '@/entities/analysis/model';
import { getSystemStatus } from '@/entities/system/api';
import { ApiError } from '@/shared/api/client';
import { describeLimits } from '@/shared/config/analysis';
import { useProject } from '@/widgets/project-workspace/project-context';
import { AnalysisResultView } from './analysis-result-view';

function statusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'interrupted':
      return 'Interrupted';
    default:
      return status;
  }
}

function costLabel(run: AnalysisRunView): string {
  if (run.estimatedCostUsd === null) return 'cost unavailable';
  return `estimated $${run.estimatedCostUsd.toFixed(4)}`;
}

function startErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) return 'AI provider is not configured on the server.';
    if (error.status === 409) return 'An analysis is already running for this project.';
    if (error.status === 404) return 'This project was not found.';
    return 'Could not start the analysis. Please try again.';
  }
  return 'Could not start the analysis. Please try again.';
}

export function ProjectAnalysisPanel() {
  const { project, refresh } = useProject();
  const [runs, setRuns] = useState<AnalysisRunView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const status = await getSystemStatus();
      setProviderConfigured(status.analysis.configured);
    } catch {
      setProviderConfigured(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await listAnalyses(project.id);
      setRuns(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analyses.');
    }
  }, [project.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  const latest = runs && runs.length > 0 ? runs[0] : null;
  const inProgress = latest?.status === 'queued' || latest?.status === 'running';

  useEffect(() => {
    if (!inProgress) return undefined;
    const id = setTimeout(() => {
      void load();
    }, 3000);
    return () => clearTimeout(id);
  }, [inProgress, latest, load]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await startAnalysis(project.id);
      await load();
    } catch (err) {
      setError(startErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onApplied = async () => {
    await refresh();
    await load();
  };

  const archived = project.status === 'archived';
  const available = providerConfigured === true;

  return (
    <fieldset className="fieldset">
      <legend>Analyze website &amp; competitors</legend>
      <p className="muted">
        Read this project&apos;s website, your objectives, and any competitor sites, then propose
        business context, audience segments, objectives, tone, and content themes. Suggestions are
        reviewable; nothing is applied automatically.
      </p>
      <p className="help">
        {describeLimits()} Manually requested public website research may run without another
        approval; applying settings requires your explicit action.
      </p>

      {providerConfigured === null && (
        <p className="muted" role="status">
          Checking analysis configuration…
        </p>
      )}
      {providerConfigured === false && (
        <p className="status-error" role="status">
          AI provider is not configured on the server, so website and competitor analysis is
          unavailable. An administrator must set the provider credential to enable it.
        </p>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="button cursor-pointer"
          onClick={start}
          disabled={busy || archived || inProgress || !available}
        >
          {busy ? 'Starting…' : inProgress ? 'Analysis running…' : 'Analyze website & competitors'}
        </button>
      </div>
      {archived && (
        <p className="muted">Archived projects cannot be analyzed. Restore the project first.</p>
      )}

      {latest && (
        <div className="analysis-status">
          <p>
            <strong>Latest analysis:</strong> {statusLabel(latest.status)}
            {latest.provider ? ` · ${latest.provider}` : ''}
            {latest.model ? ` · ${latest.model}` : ''}
          </p>
          <p className="muted">
            Started {latest.createdAt}
            {latest.finishedAt ? ` · finished ${latest.finishedAt}` : ''}
            {latest.inputTokens !== null
              ? ` · tokens ${latest.inputTokens}/${latest.outputTokens ?? 0} · ${costLabel(latest)}`
              : ''}
          </p>
          {latest.evidence && (
            <p className="muted">
              Research backend: {latest.evidence.backend ?? 'direct'}
              {typeof latest.evidence.firecrawlCredits === 'number'
                ? ` · Firecrawl credits ${latest.evidence.firecrawlCredits}`
                : ''}
            </p>
          )}
          {latest.error && (
            <p className="status-error" role="alert">
              {latest.error}
            </p>
          )}
          {latest.appliedAt && (
            <p className="muted">
              Applied {latest.appliedAt}: {latest.appliedFields.join(', ') || 'no fields'}
            </p>
          )}
          {latest.status === 'completed' && latest.result && (
            <>
              <button
                type="button"
                className="button cursor-pointer"
                onClick={() => setShowResult((value) => !value)}
              >
                {showResult ? 'Hide latest suggestions' : 'Show latest suggestions'}
              </button>
              {showResult && (
                <AnalysisResultView projectId={project.id} run={latest} onApplied={onApplied} />
              )}
            </>
          )}
          {latest.evidence && latest.evidence.failures.length > 0 && (
            <p className="help">
              Some pages could not be read: {latest.evidence.failures.map((f) => f.url).join(', ')}.
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
