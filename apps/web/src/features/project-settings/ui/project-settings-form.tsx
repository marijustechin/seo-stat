'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  archiveProject,
  restoreProject,
  updateProject,
  updateProjectSettings,
} from '@/entities/project/api';
import type { PublishingPolicy } from '@/entities/project/model';
import { timezoneOptions } from '@/shared/config/timezones';
import { useProject } from '@/widgets/project-workspace/project-context';

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

interface SettingsForm {
  name: string;
  description: string;
  websiteUrl: string;
  businessContext: string;
  audience: string;
  objectives: string;
  contentLanguage: string;
  tone: string;
  timezone: string;
  publishingPolicy: string;
  competitorUrls: string[];
}

export function ProjectSettingsForm() {
  const { project, refresh, applied } = useProject();
  const appliedRevision = useRef(0);
  const [form, setForm] = useState<SettingsForm>({
    name: project.name,
    description: project.description ?? '',
    websiteUrl: project.websiteUrl ?? '',
    businessContext: project.businessContext ?? '',
    audience: project.audience ?? '',
    objectives: project.objectives ?? '',
    contentLanguage: project.contentLanguage,
    tone: project.tone ?? '',
    timezone: project.timezone,
    publishingPolicy: project.publishingPolicy,
    competitorUrls: project.competitorUrls,
  });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (applied.revision === 0 || applied.revision === appliedRevision.current) return;
    appliedRevision.current = applied.revision;
    // Merge only the applied fields so unsaved edits to other fields are kept
    // and a later Save cannot overwrite applied values with stale state.
    setForm((current) => ({
      ...current,
      ...(applied.values.businessContext !== undefined
        ? { businessContext: applied.values.businessContext ?? '' }
        : {}),
      ...(applied.values.audience !== undefined
        ? { audience: applied.values.audience ?? '' }
        : {}),
      ...(applied.values.objectives !== undefined
        ? { objectives: applied.values.objectives ?? '' }
        : {}),
      ...(applied.values.tone !== undefined ? { tone: applied.values.tone ?? '' } : {}),
    }));
    setSaved(false);
  }, [applied]);

  const update =
    (key: keyof typeof form) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
      setSaved(false);
    };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProject(project.id, {
        name: form.name.trim(),
        description: clean(form.description),
        websiteUrl: clean(form.websiteUrl),
      });
      await updateProjectSettings(project.id, {
        businessContext: clean(form.businessContext),
        audience: clean(form.audience),
        objectives: clean(form.objectives),
        contentLanguage: form.contentLanguage.trim() || 'en',
        tone: clean(form.tone),
        timezone: form.timezone,
        publishingPolicy: form.publishingPolicy as PublishingPolicy,
        competitorUrls: form.competitorUrls.map((url) => url.trim()).filter((url) => url.length > 0),
      });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const setCompetitor = (index: number, value: string) => {
    setForm((current) => ({
      ...current,
      competitorUrls: current.competitorUrls.map((url, i) => (i === index ? value : url)),
    }));
    setSaved(false);
  };

  const addCompetitor = () => {
    setForm((current) =>
      current.competitorUrls.length >= 5
        ? current
        : { ...current, competitorUrls: [...current.competitorUrls, ''] },
    );
  };

  const removeCompetitor = (index: number) => {
    setForm((current) => ({
      ...current,
      competitorUrls: current.competitorUrls.filter((_, i) => i !== index),
    }));
    setSaved(false);
  };

  const archive = async () => {
    if (!window.confirm('Archive this project? Its history is preserved.')) return;
    setBusy(true);
    setError(null);
    try {
      await archiveProject(project.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive project.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      await restoreProject(project.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore project.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="form-success" role="status">
          Settings saved.
        </p>
      )}

      <fieldset className="fieldset">
        <legend>General</legend>
        <div className="field">
          <label htmlFor="settings-name">Name</label>
          <input
            id="settings-name"
            className="input"
            value={form.name}
            onChange={update('name')}
            maxLength={120}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="settings-description">Description</label>
          <textarea
            id="settings-description"
            className="textarea"
            value={form.description}
            onChange={update('description')}
            rows={3}
            maxLength={2000}
          />
        </div>
        <div className="field">
          <label htmlFor="settings-website">Website URL</label>
          <input
            id="settings-website"
            className="input"
            type="url"
            placeholder="https://example.com"
            value={form.websiteUrl}
            onChange={update('websiteUrl')}
            maxLength={2048}
          />
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Business context</legend>
        <div className="field">
          <label htmlFor="settings-business-context">Business context</label>
          <textarea
            id="settings-business-context"
            className="textarea"
            value={form.businessContext}
            onChange={update('businessContext')}
            rows={3}
            maxLength={4000}
          />
        </div>
        <div className="field">
          <label htmlFor="settings-audience">Audience</label>
          <textarea
            id="settings-audience"
            className="textarea"
            value={form.audience}
            onChange={update('audience')}
            rows={2}
            maxLength={4000}
          />
        </div>
        <div className="field">
          <label htmlFor="settings-objectives">Objectives</label>
          <textarea
            id="settings-objectives"
            className="textarea"
            value={form.objectives}
            onChange={update('objectives')}
            rows={2}
            maxLength={4000}
          />
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Content rules</legend>
        <div className="field">
          <label htmlFor="settings-language">Content language</label>
          <input
            id="settings-language"
            className="input"
            value={form.contentLanguage}
            onChange={update('contentLanguage')}
            maxLength={35}
          />
          <p className="help">A short language code such as en or lt.</p>
        </div>
        <div className="field">
          <label htmlFor="settings-tone">Tone</label>
          <input
            id="settings-tone"
            className="input"
            value={form.tone}
            onChange={update('tone')}
            maxLength={120}
          />
        </div>
        <div className="field">
          <label htmlFor="settings-timezone">Timezone</label>
          <select
            id="settings-timezone"
            className="select cursor-pointer"
            value={form.timezone}
            onChange={update('timezone')}
          >
            {timezoneOptions(form.timezone).map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Competitors</legend>
        <p className="muted">
          Optional competitor websites used by the analysis. Up to five. They are never invented or
          filled in for you.
        </p>
        {form.competitorUrls.map((url, index) => (
          <div className="field competitor-row" key={index}>
            <label htmlFor={`settings-competitor-${index}`}>Competitor {index + 1}</label>
            <div className="competitor-input">
              <input
                id={`settings-competitor-${index}`}
                className="input"
                type="url"
                placeholder="https://competitor.example"
                value={url}
                onChange={(event) => setCompetitor(index, event.target.value)}
                maxLength={2048}
              />
              <button
                type="button"
                className="button cursor-pointer"
                onClick={() => removeCompetitor(index)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="button cursor-pointer"
          onClick={addCompetitor}
          disabled={form.competitorUrls.length >= 5}
        >
          Add competitor
        </button>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Publishing policy</legend>
        <div className="field">
          <label htmlFor="settings-policy">Policy</label>
          <select
            id="settings-policy"
            className="select cursor-pointer"
            value={form.publishingPolicy}
            onChange={update('publishingPolicy')}
          >
            <option value="review">Review required before publishing or messaging</option>
            <option value="automatic">Automatic</option>
          </select>
          <p className="help">
            This applies to publishing, sending messages, and modifying external systems. Manually
            requested public website research may run without another approval, and applying the
            analysis suggestions always requires your explicit action.
          </p>
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="button cursor-pointer" disabled={saving || busy}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <fieldset className="fieldset">
        <legend>Integrations</legend>
        <p className="muted">
          Connections to external services are not implemented yet. No credentials are stored.
        </p>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Project status</legend>
        {project.status === 'archived' ? (
          <>
            <p className="muted">This project is archived. Its data and history are preserved.</p>
            <button
              type="button"
              className="button cursor-pointer"
              onClick={restore}
              disabled={busy}
            >
              {busy ? 'Working…' : 'Restore project'}
            </button>
          </>
        ) : (
          <>
            <p className="muted">Archiving keeps all data and history; the project is hidden from
              the active list.</p>
            <button
              type="button"
              className="button cursor-pointer"
              onClick={archive}
              disabled={busy}
            >
              {busy ? 'Working…' : 'Archive project'}
            </button>
          </>
        )}
      </fieldset>
    </form>
  );
}
