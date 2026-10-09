'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createTopic,
  dismissTopic,
  generateDraft,
  generateTopics,
  getBrief,
  listContentRuns,
  listDrafts,
  listTopics,
  saveBrief,
  updateTopic,
} from '@/entities/content/api';
import type { ArticleDraft, ContentRun, ContentTopic, TopicBrief } from '@/entities/content/model';
import { ApiError } from '@/shared/api/client';
import { useProject } from '@/widgets/project-workspace/project-context';
import { DraftEditor } from './draft-editor';

interface BriefForm {
  title: string;
  angle: string;
  audience: string;
  businessOutcome: string;
  outline: string;
  callToAction: string;
  destinationUrl: string;
  confirmations: string;
}

const EMPTY_TOPIC = { title: '', audience: '', objective: '', angle: '' };

export function ContentWorkspace() {
  const { project } = useProject();
  const [topics, setTopics] = useState<ContentTopic[] | null>(null);
  const [drafts, setDrafts] = useState<ArticleDraft[] | null>(null);
  const [runs, setRuns] = useState<ContentRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState({ ...EMPTY_TOPIC });
  const [showManual, setShowManual] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<ContentTopic | null>(null);
  const [brief, setBrief] = useState<BriefForm | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<ContentTopic | null>(null);
  const [openDraftId, setOpenDraftId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [topicList, draftList, runList] = await Promise.all([
        listTopics(project.id),
        listDrafts(project.id),
        listContentRuns(project.id),
      ]);
      setTopics(topicList);
      setDrafts(draftList);
      setRuns(runList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content.');
    }
  }, [project.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  const activeRun = runs.find((run) => run.status === 'queued' || run.status === 'running');
  useEffect(() => {
    if (!activeRun) return undefined;
    const id = setTimeout(() => {
      void load();
    }, 3000);
    return () => clearTimeout(id);
  }, [activeRun, load]);

  const runError = (err: unknown, fallback: string): string => {
    if (err instanceof ApiError) {
      if (err.status === 503) return 'AI provider is not configured on the server.';
      if (err.status === 409) return 'A generation is already running for this project or topic.';
      if (err.status === 404) return 'Not found.';
    }
    return err instanceof Error ? err.message : fallback;
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      await generateTopics(project.id);
      await load();
    } catch (err) {
      setError(runError(err, 'Failed to start topic generation.'));
    } finally {
      setBusy(false);
    }
  };

  const addManual = async () => {
    if (!manual.title.trim() || !manual.audience.trim() || !manual.objective.trim() || !manual.angle.trim()) {
      setError('Manual topics need a title, audience, objective, and angle.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createTopic(project.id, { ...manual });
      setManual({ ...EMPTY_TOPIC });
      setShowManual(false);
      await load();
    } catch (err) {
      setError(runError(err, 'Failed to create the topic.'));
    } finally {
      setBusy(false);
    }
  };

  const saveTopicEdit = async () => {
    if (!editingTopic) return;
    setBusy(true);
    try {
      await updateTopic(project.id, editingTopic.id, {
        title: editingTopic.title,
        audience: editingTopic.audience,
        objective: editingTopic.objective,
        angle: editingTopic.angle,
      });
      setEditingTopic(null);
      await load();
    } catch (err) {
      setError(runError(err, 'Failed to update the topic.'));
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (topic: ContentTopic) => {
    setBusy(true);
    try {
      await dismissTopic(project.id, topic.id);
      if (selectedTopic?.id === topic.id) setSelectedTopic(null);
      await load();
    } catch (err) {
      setError(runError(err, 'Failed to dismiss the topic.'));
    } finally {
      setBusy(false);
    }
  };

  const selectTopic = async (topic: ContentTopic) => {
    setSelectedTopic(topic);
    setBriefError(null);
    setOpenDraftId(null);
    try {
      const existing = await getBrief(project.id, topic.id);
      setBrief(toBriefForm(existing));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Prefill from the topic and saved project context; saved on first Save.
        setBrief({
          title: topic.title,
          angle: topic.angle,
          audience: topic.audience,
          businessOutcome: topic.objective,
          outline: '',
          callToAction: topic.callToAction ?? '',
          destinationUrl: '',
          confirmations: topic.informationNeeded ?? '',
        });
      } else {
        setBriefError('Failed to load the brief.');
      }
    }
  };

  const saveSelectedBrief = async () => {
    if (!selectedTopic || !brief) return;
    setBusy(true);
    setBriefError(null);
    try {
      const saved = await saveBrief(project.id, selectedTopic.id, {
        title: brief.title,
        angle: brief.angle,
        audience: brief.audience,
        businessOutcome: brief.businessOutcome,
        outline: brief.outline,
        callToAction: brief.callToAction,
        destinationUrl: brief.destinationUrl,
        confirmations: brief.confirmations.split('\n').map((line) => line.trim()).filter(Boolean),
      });
      setBrief(toBriefForm(saved));
    } catch (err) {
      setBriefError(runError(err, 'Failed to save the brief.'));
    } finally {
      setBusy(false);
    }
  };

  const startDraft = async () => {
    if (!selectedTopic) return;
    setBusy(true);
    setBriefError(null);
    try {
      await generateDraft(project.id, selectedTopic.id);
      await load();
    } catch (err) {
      setBriefError(runError(err, 'Failed to start article generation.'));
    } finally {
      setBusy(false);
    }
  };

  const openDraft = drafts?.find((draft) => draft.id === openDraftId) ?? null;
  const articleRunning = runs.some((run) => run.kind === 'article' && (run.status === 'queued' || run.status === 'running'));

  return (
    <>
      <h1>Content</h1>
      <p className="muted">Topics, briefs, and reviewable article drafts for {project.name}.</p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {activeRun && (
        <p role="status" className="muted">
          {activeRun.kind === 'topics' ? 'Generating topics' : 'Generating article draft'}… status {activeRun.status}.
        </p>
      )}
      {runs[0]?.status === 'failed' && <p className="status-error">Last generation failed: {runs[0].error}</p>}

      <section className="card">
        <div className="page-header">
          <h2>Topics</h2>
          <div className="form-actions">
            <button type="button" className="button cursor-pointer" onClick={generate} disabled={busy || !!activeRun}>
              Generate topics
            </button>
            <button type="button" className="button cursor-pointer" onClick={() => setShowManual((v) => !v)}>
              Add topic manually
            </button>
          </div>
        </div>

        {showManual && (
          <div>
            <div className="field">
              <label htmlFor="manual-title">Title</label>
              <input id="manual-title" className="input" value={manual.title} onChange={(e) => setManual((c) => ({ ...c, title: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="manual-audience">Audience</label>
              <input id="manual-audience" className="input" value={manual.audience} onChange={(e) => setManual((c) => ({ ...c, audience: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="manual-objective">Objective</label>
              <input id="manual-objective" className="input" value={manual.objective} onChange={(e) => setManual((c) => ({ ...c, objective: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="manual-angle">Angle</label>
              <input id="manual-angle" className="input" value={manual.angle} onChange={(e) => setManual((c) => ({ ...c, angle: e.target.value }))} />
            </div>
            <button type="button" className="button cursor-pointer" onClick={addManual} disabled={busy}>
              Save topic
            </button>
          </div>
        )}

        {topics === null && <p role="status" className="muted">Loading topics…</p>}
        {topics && topics.length === 0 && <p className="muted">No topics yet. Generate or add one.</p>}
        {topics && topics.length > 0 && (
          <ul className="run-list">
            {topics.map((topic) => (
              <li key={topic.id} className="run-item">
                <div className="run-head">
                  <strong>{topic.title}</strong>
                  <span className="badge">{topic.status}</span>
                </div>
                {editingTopic?.id === topic.id ? (
                  <div>
                    <div className="field">
                      <label htmlFor={`edit-title-${topic.id}`}>Title</label>
                      <input id={`edit-title-${topic.id}`} className="input" value={editingTopic.title} onChange={(e) => setEditingTopic({ ...editingTopic, title: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`edit-audience-${topic.id}`}>Audience</label>
                      <input id={`edit-audience-${topic.id}`} className="input" value={editingTopic.audience} onChange={(e) => setEditingTopic({ ...editingTopic, audience: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`edit-objective-${topic.id}`}>Objective</label>
                      <input id={`edit-objective-${topic.id}`} className="input" value={editingTopic.objective} onChange={(e) => setEditingTopic({ ...editingTopic, objective: e.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`edit-angle-${topic.id}`}>Angle</label>
                      <input id={`edit-angle-${topic.id}`} className="input" value={editingTopic.angle} onChange={(e) => setEditingTopic({ ...editingTopic, angle: e.target.value })} />
                    </div>
                    <div className="form-actions">
                      <button type="button" className="button cursor-pointer" onClick={saveTopicEdit} disabled={busy}>
                        Save
                      </button>
                      <button type="button" className="button cursor-pointer" onClick={() => setEditingTopic(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <dl className="meta">
                    <div>
                      <dt>Audience</dt>
                      <dd>{topic.audience}</dd>
                    </div>
                    <div>
                      <dt>Objective</dt>
                      <dd>{topic.objective}</dd>
                    </div>
                    <div>
                      <dt>Angle</dt>
                      <dd>{topic.angle}</dd>
                    </div>
                    {topic.callToAction && (
                      <div>
                        <dt>Call to action</dt>
                        <dd>{topic.callToAction}</dd>
                      </div>
                    )}
                    {topic.informationNeeded && (
                      <div>
                        <dt>Needed before writing</dt>
                        <dd>{topic.informationNeeded}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <div className="form-actions">
                  <button type="button" className="button cursor-pointer" onClick={() => void selectTopic(topic)}>
                    Use topic
                  </button>
                  <button type="button" className="button cursor-pointer" onClick={() => setEditingTopic(topic)}>
                    Edit
                  </button>
                  <button type="button" className="button cursor-pointer" onClick={() => void dismiss(topic)} disabled={busy}>
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedTopic && brief && (
        <section className="card">
          <h2>Brief — {selectedTopic.title}</h2>
          <p className="muted">Prefilled from the topic and saved project context. Generation starts only when you choose it.</p>
          {briefError && (
            <p className="form-error" role="alert">
              {briefError}
            </p>
          )}
          <div className="field">
            <label htmlFor="brief-title">Topic / title</label>
            <input id="brief-title" className="input" value={brief.title} onChange={(e) => setBrief({ ...brief, title: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="brief-angle">Angle</label>
            <textarea id="brief-angle" className="textarea" rows={2} value={brief.angle} onChange={(e) => setBrief({ ...brief, angle: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="brief-audience">Target audience</label>
            <input id="brief-audience" className="input" value={brief.audience} onChange={(e) => setBrief({ ...brief, audience: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="brief-outcome">Intended business outcome</label>
            <textarea id="brief-outcome" className="textarea" rows={2} value={brief.businessOutcome} onChange={(e) => setBrief({ ...brief, businessOutcome: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="brief-outline">Outline</label>
            <textarea id="brief-outline" className="textarea" rows={5} value={brief.outline} onChange={(e) => setBrief({ ...brief, outline: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="brief-cta">Call to action</label>
            <input id="brief-cta" className="input" value={brief.callToAction} onChange={(e) => setBrief({ ...brief, callToAction: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="brief-destination">Proposed destination URL</label>
            <input id="brief-destination" className="input" value={brief.destinationUrl} onChange={(e) => setBrief({ ...brief, destinationUrl: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="brief-confirmations">Facts or questions requiring confirmation (one per line)</label>
            <textarea id="brief-confirmations" className="textarea" rows={3} value={brief.confirmations} onChange={(e) => setBrief({ ...brief, confirmations: e.target.value })} />
            <p className="help">Unknown operational details stay unknown; they are not treated as established facts.</p>
          </div>
          {selectedTopic.sources.length > 0 && (
            <div className="field">
              <span>Relevant sources</span>
              <ul className="sources">
                {selectedTopic.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.url}
                    </a>
                    {source.retrievedAt ? <span className="muted"> (retrieved {source.retrievedAt})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="button cursor-pointer" onClick={saveSelectedBrief} disabled={busy}>
              Save brief
            </button>
            <button type="button" className="button cursor-pointer" onClick={startDraft} disabled={busy || articleRunning}>
              {articleRunning ? 'Generating…' : 'Generate article draft'}
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Drafts</h2>
        {drafts === null && <p role="status" className="muted">Loading drafts…</p>}
        {drafts && drafts.length === 0 && <p className="muted">No drafts yet.</p>}
        {drafts && drafts.length > 0 && (
          <ul className="run-list">
            {drafts.map((draft) => (
              <li key={draft.id} className="run-item">
                <div className="run-head">
                  <strong>
                    v{draft.version} · {draft.title ?? '(untitled)'}
                  </strong>
                  <span className="badge">{draft.status === 'ready_for_review' ? 'ready for review' : 'draft'}</span>
                </div>
                <p className="muted">
                  Updated {new Date(draft.updatedAt).toLocaleString()}
                  {draft.savedAt ? ` · saved ${new Date(draft.savedAt).toLocaleString()}` : ''}
                  {draft.unresolvedClaims.length > 0 ? ` · ${draft.unresolvedClaims.length} unresolved claim(s)` : ''}
                </p>
                <button type="button" className="button cursor-pointer" onClick={() => setOpenDraftId(openDraftId === draft.id ? null : draft.id)}>
                  {openDraftId === draft.id ? 'Close' : 'Open'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {openDraft && (
          <DraftEditor projectId={project.id} draft={openDraft} onSaved={() => void load()} />
        )}
      </section>
    </>
  );
}

function toBriefForm(brief: TopicBrief): BriefForm {
  return {
    title: brief.title,
    angle: brief.angle,
    audience: brief.audience,
    businessOutcome: brief.businessOutcome ?? '',
    outline: brief.outline ?? '',
    callToAction: brief.callToAction ?? '',
    destinationUrl: brief.destinationUrl ?? '',
    confirmations: brief.confirmations.join('\n'),
  };
}
