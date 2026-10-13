import { describe, expect, it } from 'vitest';
import type { EvidencePage } from '../analysis/research/site-reader.js';
import type { ModelGapResolution } from './content.schemas.js';
import { assembleGapDigest, type DigestInput } from './content.digest.js';
import type { GapBudget, GapRecord, SourceRef, TopicRequirement } from './content.types.js';

const BUDGET: GapBudget = {
  maxPages: 8,
  usedPages: 2,
  droppedPages: 1,
  maxInputChars: 30000,
  usedInputChars: 1200,
};

function page(url: string, title = 'Retrieved page'): EvidencePage {
  return { source: 'website', url, title, fetchedAt: '2026-10-13T10:00:00.000Z', excerpt: 'text' };
}

function requirement(overrides: Partial<TopicRequirement> = {}): TopicRequirement {
  return {
    id: 'req-0',
    question: 'Does the service cover Vilnius?',
    answer: null,
    sourceUrl: null,
    state: 'unanswered',
    ...overrides,
  };
}

function resolution(overrides: Partial<ModelGapResolution> = {}): ModelGapResolution {
  return {
    requirementId: 'req-0',
    action: 'rewritten',
    rationale: 'Rewrote the sentence so the coverage claim is unnecessary.',
    evidenceUrls: [],
    ...overrides,
  };
}

function input(overrides: Partial<DigestInput> = {}): DigestInput {
  return {
    runId: 'run-1',
    draftId: 'draft-1',
    draftVersion: 2,
    requirements: [],
    modelResolutions: [],
    retrievedPages: [],
    neutralizedClaims: [],
    budget: BUDGET,
    generatedAt: '2026-10-13T10:00:00.000Z',
    ...overrides,
  };
}

function onlyRecord(digest: { records: GapRecord[] }): GapRecord {
  const record = digest.records[0];
  if (!record) throw new Error('expected the digest to contain a record');
  return record;
}

function firstEvidence(record: GapRecord): SourceRef {
  const ref = record.evidence[0];
  if (!ref) throw new Error('expected the record to carry evidence');
  return ref;
}

describe('assembleGapDigest', () => {
  it('records a researched resolution that cites a retrieved page', () => {
    const digest = assembleGapDigest(
      input({
        requirements: [requirement()],
        modelResolutions: [
          resolution({ action: 'researched', evidenceUrls: ['https://example.test/coverage'] }),
        ],
        retrievedPages: [page('https://example.test/coverage', 'Coverage page')],
      }),
    );

    const record = onlyRecord(digest);
    expect(record.action).toBe('researched');
    expect(record.evidence).toHaveLength(1);
    expect(firstEvidence(record).url).toBe('https://example.test/coverage');
    expect(firstEvidence(record).retrievedAt).toBe('2026-10-13T10:00:00.000Z');
    expect(record.remainingUncertainty).toBeNull();
    expect(digest.counts.researched).toBe(1);
    expect(digest.counts.unresolved).toBe(0);
  });

  it('downgrades a researched claim that no retrieved source supports', () => {
    const digest = assembleGapDigest(
      input({
        requirements: [requirement()],
        modelResolutions: [
          resolution({
            action: 'researched',
            rationale: 'The website says so.',
            evidenceUrls: ['https://example.test/invented-by-the-model'],
          }),
        ],
        retrievedPages: [page('https://example.test/something-else')],
      }),
    );

    const record = onlyRecord(digest);
    expect(record.action).toBe('unresolved');
    expect(record.evidence).toHaveLength(0);
    expect(record.rationale).toMatch(/no retrieved source/i);
    expect(record.remainingUncertainty).toBe('Does the service cover Vilnius?');
    expect(digest.counts.unresolved).toBe(1);
    expect(digest.counts.researched).toBe(0);
  });

  it('accepts evidence that the per-run budget dropped from the prompt', () => {
    const digest = assembleGapDigest(
      input({
        requirements: [requirement()],
        modelResolutions: [
          resolution({ action: 'researched', evidenceUrls: ['https://example.test/dropped'] }),
        ],
        retrievedPages: [page('https://example.test/dropped', 'Retrieved but not sent')],
        budget: { ...BUDGET, droppedPages: 1 },
      }),
    );

    expect(onlyRecord(digest).action).toBe('researched');
    expect(digest.budget.droppedPages).toBe(1);
  });

  it('leaves an unreported requirement open instead of asking the operator', () => {
    const digest = assembleGapDigest(input({ requirements: [requirement()] }));
    const record = onlyRecord(digest);
    expect(record.action).toBe('unresolved');
    expect(record.rationale).toMatch(/did not report/i);
    expect(record.remainingUncertainty).toBe(record.question);
  });

  it('preserves an operator exclusion verbatim', () => {
    const digest = assembleGapDigest(
      input({ requirements: [requirement({ state: 'exclude' })] }),
    );
    const record = onlyRecord(digest);
    expect(record.action).toBe('excluded');
    expect(record.operatorState).toBe('exclude');
    expect(record.evidence).toHaveLength(0);
    expect(digest.counts.excluded).toBe(1);
  });

  it('preserves an operator answer and never labels it verified evidence', () => {
    const digest = assembleGapDigest(
      input({
        requirements: [
          requirement({ state: 'answered', answer: 'Yes, since 2019.', sourceUrl: 'https://example.test/about' }),
        ],
      }),
    );
    const record = onlyRecord(digest);
    expect(record.action).toBe('operator_answer');
    expect(record.operatorAnswer).toBe('Yes, since 2019.');
    expect(record.operatorSourceUrl).toBe('https://example.test/about');
    expect(record.remainingUncertainty).toMatch(/not independently verified/i);
    expect(digest.counts.operatorAnswer).toBe(1);
  });

  it('records operator-driven actions even when the model also reports a resolution', () => {
    const digest = assembleGapDigest(
      input({
        requirements: [requirement({ state: 'answered', answer: 'Yes.' })],
        modelResolutions: [resolution({ action: 'rewritten' })],
      }),
    );
    expect(onlyRecord(digest).action).toBe('operator_answer');
    expect(onlyRecord(digest).operatorAnswer).toBe('Yes.');
  });

  it('keeps rewritten and neutral resolutions with their remaining uncertainty', () => {
    const digest = assembleGapDigest(
      input({
        requirements: [requirement({ id: 'req-0' }), requirement({ id: 'req-1', question: 'Second gap' })],
        modelResolutions: [
          resolution({ requirementId: 'req-0', action: 'rewritten' }),
          resolution({ requirementId: 'req-1', action: 'neutral' }),
        ],
      }),
    );
    expect(digest.counts.rewritten).toBe(1);
    expect(digest.counts.neutral).toBe(1);
    expect(digest.records.every((record) => record.remainingUncertainty !== null)).toBe(true);
  });

  it('caps evidence per record', () => {
    const urls = ['https://example.test/a', 'https://example.test/b', 'https://example.test/c', 'https://example.test/d'];
    const digest = assembleGapDigest(
      input({
        requirements: [requirement()],
        modelResolutions: [resolution({ action: 'researched', evidenceUrls: urls })],
        retrievedPages: urls.map((url) => page(url)),
      }),
    );
    expect(onlyRecord(digest).evidence.length).toBeLessThanOrEqual(3);
  });

  it('carries run association, budget and neutralized claims through', () => {
    const digest = assembleGapDigest(
      input({ neutralizedClaims: [{ field: 'title', claim: 'zero landfill', note: 'substituted' }] }),
    );
    expect(digest.runId).toBe('run-1');
    expect(digest.draftId).toBe('draft-1');
    expect(digest.draftVersion).toBe(2);
    expect(digest.budget).toEqual(BUDGET);
    expect(digest.neutralizedClaims).toHaveLength(1);
  });

  it('never fails on unusable input, so recording a gap cannot fail a run', () => {
    const malformed = {
      ...input(),
      requirements: undefined,
      modelResolutions: undefined,
      retrievedPages: undefined,
      neutralizedClaims: undefined,
    } as unknown as DigestInput;

    const digest = assembleGapDigest(malformed);
    expect(digest.counts.total).toBe(0);
    expect(digest.records).toEqual([]);
    expect(digest.neutralizedClaims).toEqual([]);
  });

  it('reports an empty topic as a successful, empty digest', () => {
    const digest = assembleGapDigest(input());
    expect(digest.counts).toEqual({
      total: 0,
      researched: 0,
      rewritten: 0,
      neutral: 0,
      excluded: 0,
      operatorAnswer: 0,
      unresolved: 0,
    });
  });
});
