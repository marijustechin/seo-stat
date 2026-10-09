'use client';

import { useState } from 'react';
import { markDraftReady, saveDraft } from '@/entities/content/api';
import type { ArticleDraft } from '@/entities/content/model';
import { ApiError } from '@/shared/api/client';
import { renderMarkdown } from '@/shared/lib/markdown';
import { CoverImage } from './cover-image';
import { DraftWordpressExport } from './draft-wordpress-export';

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function DraftEditor({
  projectId,
  draft,
  onSaved,
}: {
  projectId: string;
  draft: ArticleDraft;
  onSaved: (draft: ArticleDraft) => void;
}) {
  const [form, setForm] = useState({
    title: draft.title ?? '',
    slug: draft.slug ?? '',
    seoTitle: draft.seoTitle ?? '',
    metaDescription: draft.metaDescription ?? '',
    excerpt: draft.excerpt ?? '',
    callToAction: draft.callToAction ?? '',
    bodyMarkdown: draft.bodyMarkdown,
    unresolvedClaims: draft.unresolvedClaims.join('\n'),
  });
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(draft.updatedAt);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await saveDraft(projectId, draft.id, {
        title: form.title,
        slug: form.slug,
        seoTitle: form.seoTitle,
        metaDescription: form.metaDescription,
        excerpt: form.excerpt,
        callToAction: form.callToAction,
        bodyMarkdown: form.bodyMarkdown,
        unresolvedClaims: linesToList(form.unresolvedClaims),
        expectedUpdatedAt,
      });
      setExpectedUpdatedAt(updated.updatedAt);
      setMessage(`Saved at ${new Date(updated.savedAt ?? updated.updatedAt).toLocaleString()}`);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('This draft changed since you loaded it. Reload the draft before saving.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to save the draft.');
      }
    } finally {
      setSaving(false);
    }
  };

  const markReady = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await markDraftReady(projectId, draft.id);
      setExpectedUpdatedAt(updated.updatedAt);
      setMessage('Marked ready for review (this is not publication approval).');
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark the draft ready.');
    } finally {
      setSaving(false);
    }
  };

  const claims = linesToList(form.unresolvedClaims);
  const dirty =
    form.title !== (draft.title ?? '') ||
    form.slug !== (draft.slug ?? '') ||
    form.seoTitle !== (draft.seoTitle ?? '') ||
    form.metaDescription !== (draft.metaDescription ?? '') ||
    form.excerpt !== (draft.excerpt ?? '') ||
    form.callToAction !== (draft.callToAction ?? '') ||
    form.bodyMarkdown !== draft.bodyMarkdown ||
    form.unresolvedClaims !== draft.unresolvedClaims.join('\n');

  return (
    <div className="draft-editor">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}

      <p className="muted">
        Version {draft.version} · status: {draft.status === 'ready_for_review' ? 'ready for review' : 'draft'} ·
        updated {new Date(draft.updatedAt).toLocaleString()}
      </p>

      {claims.length > 0 && (
        <div className="card status-error" role="alert">
          <strong>{claims.length} unresolved claim(s) require confirmation before review.</strong>
          <ul className="link-list">
            {claims.map((claim) => (
              <li key={claim}>{claim}</li>
            ))}
          </ul>
          <p className="help">Unresolved claims are not automatically verified; accuracy is not guaranteed.</p>
        </div>
      )}

      <div className="field">
        <label htmlFor="draft-title">Article title</label>
        <input id="draft-title" className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="draft-excerpt">Excerpt</label>
        <textarea id="draft-excerpt" className="textarea" rows={2} value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="draft-body">Markdown body</label>
        <textarea id="draft-body" className="textarea" rows={14} value={form.bodyMarkdown} onChange={(e) => set('bodyMarkdown', e.target.value)} />
      </div>
      <div className="form-actions">
        <button type="button" className="button cursor-pointer" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'Hide preview' : 'Show preview'}
        </button>
      </div>
      {showPreview && (
        <div className="markdown-preview" aria-label="Rendered preview">
          {renderMarkdown(form.bodyMarkdown)}
        </div>
      )}

      <div className="field">
        <label htmlFor="draft-slug">Slug</label>
        <input id="draft-slug" className="input" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="draft-seo-title">SEO title</label>
        <input id="draft-seo-title" className="input" value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="draft-meta">Meta description</label>
        <textarea id="draft-meta" className="textarea" rows={2} value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="draft-cta">Call to action</label>
        <input id="draft-cta" className="input" value={form.callToAction} onChange={(e) => set('callToAction', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="draft-claims">Material claims requiring confirmation (one per line)</label>
        <textarea id="draft-claims" className="textarea" rows={3} value={form.unresolvedClaims} onChange={(e) => set('unresolvedClaims', e.target.value)} />
      </div>

      {draft.sources.length > 0 && (
        <div className="field">
          <span>Sources</span>
          <ul className="sources">
            {draft.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.url}
                </a>
                {source.note ? <span className="muted"> — {source.note}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CoverImage projectId={projectId} draftId={draft.id} />

      <DraftWordpressExport projectId={projectId} draft={draft} dirty={dirty} />

      <div className="form-actions">
        <button type="button" className="button cursor-pointer" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          className="button cursor-pointer"
          onClick={markReady}
          disabled={saving || draft.status === 'ready_for_review'}
        >
          Mark ready for review
        </button>
      </div>
    </div>
  );
}
