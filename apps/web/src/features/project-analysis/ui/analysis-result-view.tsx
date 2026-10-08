'use client';

import { useState } from 'react';
import { applyAnalysis } from '@/entities/analysis/api';
import type { AnalysisResult, AnalysisRunView, SuggestionSource } from '@/entities/analysis/model';
import { ApiError } from '@/shared/api/client';

function originLabel(origin: string): string {
  switch (origin) {
    case 'user':
      return 'From your input';
    case 'website':
      return 'From your website';
    case 'competitor':
      return 'Competitor observation';
    default:
      return 'AI inference';
  }
}

function Sources({ sources }: { sources: SuggestionSource[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="sources">
      {sources.map((source) => (
        <li key={`${source.url}-${source.note}`}>
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.url}
          </a>
          {source.note ? <span className="muted"> — {source.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function audienceSummary(result: AnalysisResult): string {
  return result.audienceSegments.map((segment) => `${segment.name}: ${segment.needs}`).join('\n');
}

export function AnalysisResultView({
  projectId,
  run,
  onApplied,
}: {
  projectId: string;
  run: AnalysisRunView;
  onApplied: () => void;
}) {
  const result = run.result;
  const [selection, setSelection] = useState({
    businessContext: true,
    audience: true,
    objectives: true,
    tone: true,
  });
  const [values, setValues] = useState({
    businessContext: result?.businessContext.value ?? '',
    audience: result ? audienceSummary(result) : '',
    objectives: result?.objectives.value ?? '',
    tone: result?.tone.value ?? '',
  });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  if (!result) return null;

  const toggle = (key: keyof typeof selection) =>
    setSelection((current) => ({ ...current, [key]: !current[key] }));

  const apply = async () => {
    if (run.conflict && !confirmed) {
      setError('Project settings changed since this analysis started. Tick the confirmation to apply.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await applyAnalysis(projectId, run.id, {
        acknowledgeConflict: run.conflict ? true : undefined,
        ...selection,
        businessContextValue: values.businessContext,
        audienceValue: values.audience,
        objectivesValue: values.objectives,
        toneValue: values.tone,
      });
      setApplied(true);
      onApplied();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('The project changed while applying. Review the current values and confirm again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to apply suggestions.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="analysis-result">
      {run.conflict && (
        <p className="form-error" role="alert">
          Project settings changed since this analysis started. Compare the proposed and current
          values before applying.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {applied && (
        <p className="form-success" role="status">
          Applied selected suggestions. Publishing policy was not changed.
        </p>
      )}

      <fieldset className="fieldset">
        <legend>Business context</legend>
        <label className="check">
          <input type="checkbox" checked={selection.businessContext} onChange={() => toggle('businessContext')} />
          Apply this field
        </label>
        <label className="field">
          <span>Proposed value</span>
          <textarea
            className="textarea"
            rows={3}
            value={values.businessContext}
            onChange={(event) => setValues((current) => ({ ...current, businessContext: event.target.value }))}
          />
        </label>
        <p className="muted">
          Current: {run.inputSnapshot.businessContext || 'not set'}
        </p>
        <p className="help">
          {originLabel(result.businessContext.origin)} · confidence {result.businessContext.confidence}
        </p>
        <p>{result.businessContext.rationale}</p>
        <Sources sources={result.businessContext.sources} />
      </fieldset>

      <fieldset className="fieldset">
        <legend>Audience</legend>
        <label className="check">
          <input type="checkbox" checked={selection.audience} onChange={() => toggle('audience')} />
          Apply a readable summary to the audience field
        </label>
        <label className="field">
          <span>Summary to save</span>
          <textarea
            className="textarea"
            rows={4}
            value={values.audience}
            onChange={(event) => setValues((current) => ({ ...current, audience: event.target.value }))}
          />
        </label>
        <p className="muted">
          Current: {run.inputSnapshot.audience || 'not set'}
        </p>
        <div className="segments">
          {result.audienceSegments.map((segment) => (
            <div className="segment" key={segment.name}>
              <h3>{segment.name}</h3>
              <p>
                <strong>Needs:</strong> {segment.needs}
              </p>
              <p>
                <strong>Offering:</strong> {segment.offering}
              </p>
              <p>
                <strong>Desired action:</strong> {segment.desiredAction}
              </p>
              {segment.contentDirections.length > 0 && (
                <p>
                  <strong>Content directions:</strong> {segment.contentDirections.join('; ')}
                </p>
              )}
              <p className="help">
                {originLabel(segment.origin)} · confidence {segment.confidence}
              </p>
              <Sources sources={segment.sources} />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Objectives</legend>
        <label className="check">
          <input type="checkbox" checked={selection.objectives} onChange={() => toggle('objectives')} />
          Apply a clearer formulation
        </label>
        <label className="field">
          <span>Proposed value</span>
          <textarea
            className="textarea"
            rows={3}
            value={values.objectives}
            onChange={(event) => setValues((current) => ({ ...current, objectives: event.target.value }))}
          />
        </label>
        <p className="muted">
          Current: {run.inputSnapshot.objectives || 'not set'}
        </p>
        <p className="help">
          {originLabel(result.objectives.origin)} · confidence {result.objectives.confidence}
        </p>
        <p>{result.objectives.rationale}</p>
        <Sources sources={result.objectives.sources} />
      </fieldset>

      <fieldset className="fieldset">
        <legend>Tone</legend>
        <label className="check">
          <input type="checkbox" checked={selection.tone} onChange={() => toggle('tone')} />
          Apply this field
        </label>
        <label className="field">
          <span>Proposed value</span>
          <input
            className="input"
            value={values.tone}
            onChange={(event) => setValues((current) => ({ ...current, tone: event.target.value }))}
          />
        </label>
        <p className="muted">
          Current: {run.inputSnapshot.tone || 'not set'}
        </p>
        <p className="help">
          {originLabel(result.tone.origin)} · confidence {result.tone.confidence}
        </p>
        <Sources sources={result.tone.sources} />
      </fieldset>

      <fieldset className="fieldset">
        <legend>Content themes</legend>
        <ul className="link-list">
          {result.contentThemes.map((theme) => (
            <li key={theme.theme}>
              <strong>{theme.theme}</strong> — {theme.rationale}{' '}
              <span className="help">({originLabel(theme.origin)})</span>
            </li>
          ))}
        </ul>
      </fieldset>

      {result.missingInformation.length > 0 && (
        <fieldset className="fieldset">
          <legend>Missing information</legend>
          <ul className="link-list">
            {result.missingInformation.map((item) => (
              <li key={item.question}>
                <strong>{item.question}</strong> — {item.why}
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {run.conflict && (
        <label className="check">
          <input type="checkbox" checked={confirmed} onChange={() => setConfirmed((value) => !value)} />
          I reviewed the proposals against the current project values
        </label>
      )}

      <div className="form-actions">
        <button type="button" className="button cursor-pointer" onClick={apply} disabled={busy}>
          {busy ? 'Applying…' : 'Apply selected suggestions'}
        </button>
      </div>
      <p className="help">Applying suggestions never changes the publishing policy.</p>
    </div>
  );
}
