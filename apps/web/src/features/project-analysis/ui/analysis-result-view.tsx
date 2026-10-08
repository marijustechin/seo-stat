'use client';

import { useMemo, useState } from 'react';
import { applyAnalysis } from '@/entities/analysis/api';
import type { AnalysisResult, AnalysisRunView, SuggestionSource } from '@/entities/analysis/model';
import { ApiError } from '@/shared/api/client';
import {
  APPLIED_FIELD_LABELS,
  SUGGESTION_LIMITS,
  TONE_HELP,
  validateSuggestionValues,
  type AppliedField,
  type SuggestionSelection,
  type SuggestionValues,
} from '@/shared/config/suggestion-limits';

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

function Counter({ length, limit }: { length: number; limit: number }) {
  return (
    <span className={length > limit ? 'counter counter-over' : 'counter'}>
      {length} / {limit}
    </span>
  );
}

export function AnalysisResultView({
  projectId,
  run,
  onApplied,
}: {
  projectId: string;
  run: AnalysisRunView;
  onApplied: (values: Partial<Record<AppliedField, string | null>>) => void;
}) {
  const result = run.result;
  const [selection, setSelection] = useState<SuggestionSelection>({
    businessContext: true,
    audience: true,
    objectives: true,
    tone: true,
  });
  const [values, setValues] = useState<SuggestionValues>({
    businessContext: result?.businessContext.value ?? '',
    audience: result ? audienceSummary(result) : '',
    objectives: result?.objectives.value ?? '',
    tone: result?.tone.value ?? '',
  });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedFields, setAppliedFields] = useState<string[] | null>(null);

  const errors = useMemo(() => validateSuggestionValues(selection, values), [selection, values]);
  const includes = (field: AppliedField) => selection[field];
  const selectedFields = (Object.keys(SUGGESTION_LIMITS) as AppliedField[]).filter(includes);
  const canApply = selectedFields.length > 0 && Object.keys(errors).length === 0;

  if (!result) return null;

  const toggle = (key: AppliedField) =>
    setSelection((current) => ({ ...current, [key]: !current[key] }));

  const setValue = (key: AppliedField, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const apply = async () => {
    if (run.conflict && !confirmed) {
      setError('Project settings changed since this analysis started. Tick the confirmation to apply.');
      return;
    }
    if (!canApply) {
      setError('Select at least one valid field before saving.');
      return;
    }
    setBusy(true);
    setError(null);
    setAppliedFields(null);
    const payload: Partial<Record<AppliedField, string>> = {};
    for (const field of selectedFields) payload[field] = values[field];
    try {
      await applyAnalysis(projectId, run.id, {
        acknowledgeConflict: run.conflict ? true : undefined,
        ...selection,
        businessContextValue: values.businessContext,
        audienceValue: values.audience,
        objectivesValue: values.objectives,
        toneValue: values.tone,
      });
      setAppliedFields(selectedFields.map((field) => APPLIED_FIELD_LABELS[field]));
      onApplied(payload);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('The project changed while saving. Review the current values and confirm again.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('The server rejected one of the selected values. Check the field limits and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save suggestions.');
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
          values before saving.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {appliedFields && (
        <p className="form-success" role="status">
          Saved to project settings: {appliedFields.join(', ') || 'nothing'}. Publishing policy was
          not changed.
        </p>
      )}

      <fieldset className="fieldset">
        <legend>Business context</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={selection.businessContext}
            onChange={() => toggle('businessContext')}
          />
          Save this field
        </label>
        <label className="field">
          <span>
            Proposed value <Counter length={values.businessContext.length} limit={SUGGESTION_LIMITS.businessContext} />
          </span>
          <textarea
            className="textarea"
            rows={3}
            value={values.businessContext}
            onChange={(event) => setValue('businessContext', event.target.value)}
          />
        </label>
        {errors.businessContext && (
          <p className="status-error" role="alert">
            {errors.businessContext}
          </p>
        )}
        <p className="muted">Current: {run.inputSnapshot.businessContext || 'not set'}</p>
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
          Save a readable summary to the audience field
        </label>
        <label className="field">
          <span>
            Summary to save <Counter length={values.audience.length} limit={SUGGESTION_LIMITS.audience} />
          </span>
          <textarea
            className="textarea"
            rows={4}
            value={values.audience}
            onChange={(event) => setValue('audience', event.target.value)}
          />
        </label>
        {errors.audience && (
          <p className="status-error" role="alert">
            {errors.audience}
          </p>
        )}
        <p className="muted">Current: {run.inputSnapshot.audience || 'not set'}</p>
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
        <p className="help">Detailed segments stay saved in this analysis.</p>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Objectives</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={selection.objectives}
            onChange={() => toggle('objectives')}
          />
          Save a clearer formulation
        </label>
        <label className="field">
          <span>
            Proposed value <Counter length={values.objectives.length} limit={SUGGESTION_LIMITS.objectives} />
          </span>
          <textarea
            className="textarea"
            rows={3}
            value={values.objectives}
            onChange={(event) => setValue('objectives', event.target.value)}
          />
        </label>
        {errors.objectives && (
          <p className="status-error" role="alert">
            {errors.objectives}
          </p>
        )}
        <p className="muted">Current: {run.inputSnapshot.objectives || 'not set'}</p>
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
          Save this field
        </label>
        <label className="field">
          <span>
            Proposed value <Counter length={values.tone.length} limit={SUGGESTION_LIMITS.tone} />
          </span>
          <input
            className="input"
            value={values.tone}
            onChange={(event) => setValue('tone', event.target.value)}
          />
        </label>
        {errors.tone && (
          <p className="status-error" role="alert">
            {errors.tone}
          </p>
        )}
        <p className="help">{TONE_HELP}</p>
        <p className="muted">Current: {run.inputSnapshot.tone || 'not set'}</p>
        <p className="help">
          {originLabel(result.tone.origin)} · confidence {result.tone.confidence}
        </p>
        <p>{result.tone.rationale}</p>
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
          <p className="muted">Research guidance. Saving project settings does not remove these.</p>
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
          <input
            type="checkbox"
            checked={confirmed}
            onChange={() => setConfirmed((value) => !value)}
          />
          I reviewed the proposals against the current project values
        </label>
      )}

      <div className="save-summary">
        <p>
          <strong>Will save:</strong>{' '}
          {selectedFields.length === 0
            ? 'nothing selected'
            : selectedFields.map((field) => APPLIED_FIELD_LABELS[field]).join(', ')}
        </p>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="button cursor-pointer"
          onClick={apply}
          disabled={busy || !canApply}
        >
          {busy ? 'Saving…' : 'Save selected suggestions to project settings'}
        </button>
      </div>
      <p className="help">Unselected fields and the publishing policy are left unchanged.</p>
    </div>
  );
}
