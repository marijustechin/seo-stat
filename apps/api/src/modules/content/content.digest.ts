import type { EvidencePage } from '../analysis/research/site-reader.js';
import { CONTENT_LIMITS } from './content.limits.js';
import type { ModelGapResolution } from './content.schemas.js';
import type {
  GapBudget,
  GapCounts,
  GapDigest,
  GapRecord,
  SourceRef,
  TopicRequirement,
} from './content.types.js';

export interface ClaimNeutralization {
  field: string;
  claim: string;
  note: string;
}

export interface DigestInput {
  runId: string;
  draftId: string | null;
  draftVersion: number | null;
  requirements: TopicRequirement[];
  modelResolutions: ModelGapResolution[];
  /** Every page retrieved during this run, including pages the budget dropped. */
  retrievedPages: EvidencePage[];
  neutralizedClaims: ClaimNeutralization[];
  budget: GapBudget;
  generatedAt: string;
}

/**
 * Maps cited URLs to real evidence. A URL that was not retrieved during this run
 * is not evidence, however confidently the model cites it, so it is dropped here
 * and the caller downgrades the resolution to `unresolved`.
 */
function evidenceFor(urls: unknown, pages: EvidencePage[]): SourceRef[] {
  if (!Array.isArray(urls)) return [];
  const byUrl = new Map(pages.map((page) => [page.url, page]));
  const refs: SourceRef[] = [];
  for (const candidate of urls) {
    if (typeof candidate !== 'string') continue;
    const page = byUrl.get(candidate);
    if (!page) continue;
    if (refs.some((ref) => ref.url === page.url)) continue;
    refs.push({
      url: page.url,
      note: page.title && page.title.length > 0 ? page.title : 'Retrieved page',
      retrievedAt: page.fetchedAt,
    });
    if (refs.length >= CONTENT_LIMITS.gapEvidencePerRecord) break;
  }
  return refs;
}

function operatorRecord(requirement: TopicRequirement): GapRecord {
  const base = {
    requirementId: requirement.id,
    question: requirement.question,
    operatorState: requirement.state,
    operatorAnswer: requirement.answer ?? null,
    operatorSourceUrl: requirement.sourceUrl ?? null,
  };

  if (requirement.state === 'exclude') {
    return {
      ...base,
      action: 'excluded',
      rationale: 'The operator excluded this claim, so the article does not assert it.',
      evidence: [],
      remainingUncertainty: null,
    };
  }

  return {
    ...base,
    action: 'operator_answer',
    rationale:
      'The operator supplied this answer. It is used as provided information, not as independently verified evidence.',
    evidence: requirement.sourceUrl
      ? [{ url: requirement.sourceUrl, note: 'Reference supplied by the operator' }]
      : [],
    remainingUncertainty: 'Operator-provided and not independently verified.',
  };
}

function generatedRecord(
  requirement: TopicRequirement,
  reported: ModelGapResolution | undefined,
  pages: EvidencePage[],
): GapRecord {
  const base = {
    requirementId: requirement.id,
    question: requirement.question,
    operatorState: requirement.state,
    operatorAnswer: requirement.answer ?? null,
    operatorSourceUrl: requirement.sourceUrl ?? null,
  };

  if (!reported) {
    return {
      ...base,
      action: 'unresolved',
      rationale: 'Generation did not report a resolution, so this gap was left open.',
      evidence: [],
      remainingUncertainty: requirement.question,
    };
  }

  const rationale = reported.rationale.slice(0, CONTENT_LIMITS.gapRationale);

  if (reported.action === 'researched') {
    const evidence = evidenceFor(reported.evidenceUrls, pages);
    if (evidence.length === 0) {
      return {
        ...base,
        action: 'unresolved',
        rationale:
          'Reported as resolved by research, but no retrieved source supports it, so it is recorded as open instead.',
        evidence: [],
        remainingUncertainty: requirement.question,
      };
    }
    return {
      ...base,
      action: 'researched',
      rationale,
      evidence,
      remainingUncertainty: null,
    };
  }

  return {
    ...base,
    action: reported.action,
    rationale,
    evidence: [],
    remainingUncertainty: requirement.question,
  };
}

function countRecords(records: GapRecord[], total: number): GapCounts {
  const counts: GapCounts = {
    total,
    researched: 0,
    rewritten: 0,
    neutral: 0,
    excluded: 0,
    operatorAnswer: 0,
    unresolved: 0,
  };
  for (const record of records) {
    if (record.action === 'researched') counts.researched += 1;
    else if (record.action === 'rewritten') counts.rewritten += 1;
    else if (record.action === 'neutral') counts.neutral += 1;
    else if (record.action === 'excluded') counts.excluded += 1;
    else if (record.action === 'operator_answer') counts.operatorAnswer += 1;
    else counts.unresolved += 1;
  }
  return counts;
}

/**
 * Assembles the gap resolution digest of one article run.
 *
 * Deliberately total: every input is tolerated, nothing throws, and a missing or
 * unusable model resolution becomes `unresolved`. Assembling the record of what
 * was skipped must never be the reason a run fails, and it must never become a
 * request for human input.
 */
export function assembleGapDigest(input: DigestInput): GapDigest {
  const requirements = Array.isArray(input.requirements) ? input.requirements : [];
  const resolutions = Array.isArray(input.modelResolutions) ? input.modelResolutions : [];
  const pages = Array.isArray(input.retrievedPages) ? input.retrievedPages : [];
  const byRequirement = new Map(resolutions.map((item) => [item.requirementId, item]));

  const records: GapRecord[] = requirements.map((requirement) =>
    requirement.state === 'answered' || requirement.state === 'exclude'
      ? operatorRecord(requirement)
      : generatedRecord(requirement, byRequirement.get(requirement.id), pages),
  );

  return {
    runId: input.runId,
    draftId: input.draftId,
    draftVersion: input.draftVersion,
    generatedAt: input.generatedAt,
    counts: countRecords(records, requirements.length),
    budget: input.budget,
    records,
    neutralizedClaims: Array.isArray(input.neutralizedClaims) ? input.neutralizedClaims : [],
  };
}
