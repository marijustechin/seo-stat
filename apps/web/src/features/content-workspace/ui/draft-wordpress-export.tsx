'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  exportDraftToWordpress,
  getDraftExport,
  reconcileDraftExport,
} from '@/entities/integration/api';
import type { DraftExport, WordpressExportStatus } from '@/entities/integration/model';
import type { ArticleDraft } from '@/entities/content/model';
import { apiUrl } from '@/shared/config/app';

function statusLabel(status: WordpressExportStatus): string {
  switch (status) {
    case 'in_progress':
      return 'in progress';
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'uncertain':
      return 'outcome uncertain';
    case 'conflict':
      return 'remote conflict';
  }
}

export function DraftWordpressExport({
  projectId,
  draft,
  dirty,
  onExported,
}: {
  projectId: string;
  draft: ArticleDraft;
  dirty: boolean;
  onExported?: () => void;
}) {
  const [state, setState] = useState<DraftExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await getDraftExport(projectId, draft.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the export state.');
    }
  }, [projectId, draft.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  const run = async (action: () => Promise<DraftExport>, fallback: string, done: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setState(await action());
      setNotice(done);
      onExported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const exportNow = () =>
    run(
      () => exportDraftToWordpress(projectId, draft.id, { expectedUpdatedAt: draft.updatedAt }),
      'Failed to send the draft to WordPress.',
      'Sent to WordPress as a draft.',
    );

  const reconcile = () =>
    run(() => reconcileDraftExport(projectId, draft.id), 'Failed to reconcile the export.', 'Export reconciled.');

  const disabled = busy || dirty || !state?.eligible || state?.inProgress;
  const isUpdate = Boolean(state?.remotePostId);

  return (
    <div className="card">
      <h3>Send to WordPress</h3>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="form-success" role="status">
          {notice}
        </p>
      )}
      {state === null && <p role="status" className="muted">Loading export state…</p>}

      {state && !state.configured && (
        <p className="muted">
          WordPress is not connected for this project. Connect it in <strong>Settings → WordPress</strong>.
        </p>
      )}

      {state?.configured && (
        <>
          <p className="muted">
            The WordPress post is created as a <strong>draft</strong> and is never published or
            scheduled by SEO-STAT, regardless of the project publishing policy.
          </p>
          <dl className="meta">
            <div>
              <dt>Destination</dt>
              <dd>{state.siteUrl}</dd>
            </div>
            <div>
              <dt>Article title</dt>
              <dd>{draft.title ?? '(untitled)'}</dd>
            </div>
            <div>
              <dt>Selected cover</dt>
              <dd>
                {state.cover ? (
                  <>
                    {state.cover.fileName ?? 'cover'}
                    {state.cover.hasAlt ? '' : ' (no alt text)'}
                    {state.cover.reusedRemoteMediaId
                      ? ` — reusing WordPress media #${state.cover.reusedRemoteMediaId}`
                      : ''}
                  </>
                ) : (
                  'No selected cover; the post will have no featured image.'
                )}
              </dd>
            </div>
          </dl>
          {state.cover && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element -- same-origin project-scoped asset */}
              <img src={apiUrl(state.cover.url)} alt="Selected cover" className="cover-preview" />
            </figure>
          )}

          {!state.eligible && state.ineligibleReason && <p className="status-error">{state.ineligibleReason}</p>}
          {dirty && (
            <p className="status-error" role="alert">
              This draft has unsaved changes. Save the draft before exporting so the persisted values are sent.
            </p>
          )}
          {state.changedSinceExport && state.remotePostId && (
            <p className="muted" role="status">
              The draft has changed since the last export. Exporting will update the same WordPress draft
              {state.lastExportedVersion ? ` (last exported version ${state.lastExportedVersion})` : ''}.
            </p>
          )}
          {state.remoteEditDetected && (
            <p className="status-error" role="status">
              The WordPress post was edited outside SEO-STAT or is no longer a draft. It will not be
              overwritten automatically; reconcile or review it in WordPress.
            </p>
          )}
          {state.inProgress && (
            <p role="status" className="muted">
              An export is in progress…
            </p>
          )}
          {(state.status === 'uncertain' || state.status === 'conflict') && (
            <div className="form-actions">
              <button type="button" className="button cursor-pointer" onClick={reconcile} disabled={busy}>
                {busy ? 'Working…' : 'Reconcile with WordPress'}
              </button>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="button cursor-pointer" onClick={exportNow} disabled={disabled}>
              {busy ? 'Working…' : isUpdate ? 'Update WordPress draft' : 'Send draft to WordPress'}
            </button>
            {state.remoteLink && (
              <a className="button cursor-pointer" href={state.remoteLink} target="_blank" rel="noreferrer">
                Open in WordPress editor
              </a>
            )}
          </div>

          {state.attempts.length > 0 && (
            <details>
              <summary>Export history ({state.attempts.length})</summary>
              <ul className="run-list">
                {state.attempts.map((attempt) => (
                  <li key={attempt.id} className="run-item">
                    <div className="run-head">
                      <strong>
                        {statusLabel(attempt.status)} · draft v{attempt.draftVersion}
                      </strong>
                      <span className="muted">{new Date(attempt.createdAt).toLocaleString()}</span>
                    </div>
                    {attempt.remotePostId && <p className="muted">WordPress post #{attempt.remotePostId}</p>}
                    {attempt.remoteMediaId && <p className="muted">WordPress media #{attempt.remoteMediaId}</p>}
                    {attempt.error && <p className="status-error">{attempt.error}</p>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
