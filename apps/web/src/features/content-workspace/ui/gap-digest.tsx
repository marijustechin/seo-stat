'use client';

import type { GapAction, GapDigest, LinkPlan } from '@/entities/content/model';

const ACTION_LABELS: Record<GapAction, string> = {
  researched: 'Resolved by research',
  rewritten: 'Rewritten to avoid the claim',
  neutral: 'Neutral wording',
  excluded: 'Excluded by you',
  operator_answer: 'Your answer',
  unresolved: 'Left open',
};

const LINK_SOURCE_NOTES: Record<LinkPlan['source'], string> = {
  sitemap: 'chosen from the site sitemap',
  research: 'chosen from the pages already read',
  none: 'no page list was available, so no internal links were placed',
};

export function GapDigestPanel({
  digest,
  linkPlan = null,
}: {
  digest: GapDigest | null;
  linkPlan?: LinkPlan | null;
}) {
  if (!digest && !linkPlan) {
    return null;
  }

  return (
    <details>
      <summary>
        {digest
          ? `Gap report — ${digest.counts.researched} resolved by research, ${digest.counts.unresolved} left open`
          : 'Link report'}
      </summary>
      {digest && (
        <>
          <p className="muted">
            Automatic record of how information gaps were handled. Nothing here blocks generation or
            publication.
          </p>
          {digest.budget.droppedPages > 0 && (
            <p className="muted">
              Research budget reached: {digest.budget.usedPages} of {digest.budget.maxPages} pages used.
            </p>
          )}
          {digest.records.length > 0 && (
            <ul className="run-list">
              {digest.records.map((record) => (
                <li key={record.requirementId} className="run-item">
                  <div className="run-head">
                    <strong>{record.question}</strong>
                    <span className="badge">{ACTION_LABELS[record.action]}</span>
                  </div>
                  <p>{record.rationale}</p>
                  {record.remainingUncertainty && (
                    <p className="muted">Remaining uncertainty: {record.remainingUncertainty}</p>
                  )}
                  {record.evidence.length > 0 && (
                    <ul className="sources">
                      {record.evidence.map((source) => (
                        <li key={source.url}>
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.url}
                          </a>
                          {source.note ? <span className="muted"> — {source.note}</span> : null}
                          {source.retrievedAt ? <span className="muted"> (retrieved {source.retrievedAt})</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          {digest.neutralizedClaims.length > 0 && (
            <div className="field">
              <p className="muted">Neutralized claims</p>
              <ul className="link-list">
                {digest.neutralizedClaims.map((claim) => (
                  <li key={`${claim.field}-${claim.claim}`}>
                    <strong>{claim.field}</strong>: {claim.claim}
                    {claim.note ? <span className="muted"> — {claim.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {linkPlan && (
        <div className="field">
          <p className="muted">Links</p>
          <p className="muted">
            {linkPlan.internal.length} internal, {linkPlan.external.length} external
            {linkPlan.dropped.length > 0 ? `, ${linkPlan.dropped.length} removed` : ''} —{' '}
            {LINK_SOURCE_NOTES[linkPlan.source]}.
          </p>
          {linkPlan.truncated > 0 && (
            <p className="muted">
              The page list was capped: {linkPlan.candidates} pages found, {linkPlan.truncated} left out.
            </p>
          )}
          {linkPlan.dropped.length > 0 && (
            <ul className="link-list">
              {linkPlan.dropped.map((entry) => (
                <li key={`${entry.kind}-${entry.url}-${entry.text}`}>
                  <strong>{entry.kind === 'internal' ? 'Internal' : 'External'}</strong>: {entry.url}
                  <span className="muted"> — {entry.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </details>
  );
}
