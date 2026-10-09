'use client';

import { useState } from 'react';
import type { TopicRequirement } from '@/entities/content/model';

const STATES: Array<TopicRequirement['state']> = ['unanswered', 'answered', 'unknown', 'exclude'];

function newRequirement(): TopicRequirement {
  return {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    question: '',
    answer: null,
    sourceUrl: null,
    state: 'unanswered',
  };
}

export function AnswersEditor({
  requirements,
  onChange,
  onKeepKnowledge,
}: {
  requirements: TopicRequirement[];
  onChange: (next: TopicRequirement[]) => void;
  onKeepKnowledge?: (requirement: TopicRequirement) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const update = (index: number, patch: Partial<TopicRequirement>) => {
    onChange(requirements.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  if (requirements.length === 0) {
    return (
      <div className="field">
        <span>Needed before writing</span>
        <p className="muted">No information requirements on this topic.</p>
        <button
          type="button"
          className="button cursor-pointer"
          onClick={() => onChange([newRequirement()])}
        >
          Add requirement
        </button>
      </div>
    );
  }

  return (
    <div className="field">
      <div className="run-head">
        <span>Needed before writing</span>
        <button type="button" className="button cursor-pointer" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Hide answers' : 'Show answers'}
        </button>
      </div>
      {expanded &&
        requirements.map((item, index) => (
          <div className="segment" key={item.id}>
            <p>
              <strong>{item.question}</strong>
            </p>
            <div className="field">
              <label htmlFor={`req-answer-${item.id}`}>Answer / clarification</label>
              <textarea
                id={`req-answer-${item.id}`}
                className="textarea"
                rows={2}
                value={item.answer ?? ''}
                onChange={(event) => update(index, { answer: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`req-source-${item.id}`}>Source URL / reference (optional)</label>
              <input
                id={`req-source-${item.id}`}
                className="input"
                value={item.sourceUrl ?? ''}
                onChange={(event) => update(index, { sourceUrl: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`req-state-${item.id}`}>State</label>
              <select
                id={`req-state-${item.id}`}
                className="select cursor-pointer"
                value={item.state}
                onChange={(event) => update(index, { state: event.target.value as TopicRequirement['state'] })}
              >
                {STATES.map((state) => (
                  <option key={state} value={state}>
                    {state === 'unanswered'
                      ? 'Unanswered'
                      : state === 'answered'
                        ? 'Answered'
                        : state === 'unknown'
                          ? 'Unknown (do not invent an answer)'
                          : 'Exclude this claim from the article'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              {onKeepKnowledge && item.state === 'answered' && item.answer && (
                <button type="button" className="button cursor-pointer" onClick={() => onKeepKnowledge(item)}>
                  Keep as reusable project knowledge
                </button>
              )}
              <button
                type="button"
                className="button cursor-pointer"
                onClick={() => onChange(requirements.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      <button type="button" className="button cursor-pointer" onClick={() => onChange([...requirements, newRequirement()])}>
        Add requirement
      </button>
      <p className="help">
        Answered values are treated as user-provided information, not independently verified website
        evidence.
      </p>
    </div>
  );
}
