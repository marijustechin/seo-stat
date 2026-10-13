export const CONTENT_RUN_KINDS = ['topics', 'article'] as const;
export type ContentRunKind = (typeof CONTENT_RUN_KINDS)[number];

export const CONTENT_RUN_STATUSES = ['queued', 'running', 'completed', 'failed', 'interrupted'] as const;
export type ContentRunStatus = (typeof CONTENT_RUN_STATUSES)[number];

export const TOPIC_STATUSES = ['suggested', 'selected', 'dismissed'] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const TOPIC_PRIORITIES = ['primary', 'secondary', 'supporting'] as const;
export type TopicPriority = (typeof TOPIC_PRIORITIES)[number];

export const REQUIREMENT_STATES = ['unanswered', 'answered', 'unknown', 'exclude'] as const;
export type RequirementState = (typeof REQUIREMENT_STATES)[number];

/** A "needed before writing" requirement and the user's answer. */
export interface TopicRequirement {
  id: string;
  question: string;
  answer: string | null;
  sourceUrl: string | null;
  state: RequirementState;
}

export interface ProjectKnowledgeView {
  id: string;
  projectId: string;
  text: string;
  originQuestion: string | null;
  originTopicId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentSettingsSnapshot {
  websiteUrl: string | null;
  businessContext: string | null;
  audience: string | null;
  objectives: string | null;
  contentLanguage: string;
  tone: string | null;
  capturedAt: string;
}

export interface SourceRef {
  url: string;
  note: string;
  retrievedAt?: string;
}

/** Every action the gap resolution ladder can record for one requirement. */
export const GAP_ACTIONS = [
  'researched',
  'rewritten',
  'neutral',
  'excluded',
  'operator_answer',
  'unresolved',
] as const;
export type GapAction = (typeof GAP_ACTIONS)[number];

/** Actions a model may report. Operator-driven actions are decided server-side. */
export const MODEL_GAP_ACTIONS = ['researched', 'rewritten', 'neutral', 'unresolved'] as const;
export type ModelGapAction = (typeof MODEL_GAP_ACTIONS)[number];

export interface GapRecord {
  requirementId: string;
  question: string;
  /** The operator's input, preserved verbatim and never overwritten. */
  operatorState: RequirementState;
  operatorAnswer: string | null;
  operatorSourceUrl: string | null;
  action: GapAction;
  rationale: string;
  evidence: SourceRef[];
  remainingUncertainty: string | null;
}

export interface GapCounts {
  total: number;
  researched: number;
  rewritten: number;
  neutral: number;
  excluded: number;
  operatorAnswer: number;
  unresolved: number;
}

export interface GapBudget {
  maxPages: number;
  usedPages: number;
  droppedPages: number;
  maxInputChars: number;
  usedInputChars: number;
}

/**
 * Read-only record of how one article run handled its information gaps. It is
 * evidence, never a gate: nothing waits for it and nothing can acknowledge it.
 */
export interface GapDigest {
  runId: string;
  draftId: string | null;
  draftVersion: number | null;
  generatedAt: string;
  counts: GapCounts;
  budget: GapBudget;
  records: GapRecord[];
  neutralizedClaims: Array<{ field: string; claim: string; note: string }>;
}

export interface LinkPlanEntry {
  url: string;
  text: string;
  kind: 'internal' | 'external';
}

export interface DroppedLinkEntry {
  url: string;
  text: string;
  kind: 'internal' | 'external';
  reason: string;
}

/**
 * Read-only record of the links one article run placed. An internal link is kept
 * only when it points at a page in the project's own URL list, and an external
 * link only when the page was retrieved during that run. Anything else keeps its
 * anchor text and loses the URL.
 */
export interface LinkPlan {
  /** Where the project's URL list came from. */
  source: 'sitemap' | 'research' | 'none';
  /** Usable internal paths found, and how many were left out of the prompt. */
  candidates: number;
  truncated: number;
  internal: LinkPlanEntry[];
  external: LinkPlanEntry[];
  dropped: DroppedLinkEntry[];
}

export interface BriefSnapshot {
  title: string;
  angle: string;
  audience: string;
  businessOutcome: string | null;
  outline: string | null;
  callToAction: string | null;
  destinationUrl: string | null;
  sources: SourceRef[];
  confirmations: string[];
  answers: TopicRequirement[];
}

export interface TopicView {
  id: string;
  projectId: string;
  title: string;
  audience: string;
  objective: string;
  readerNeed: string | null;
  angle: string;
  callToAction: string | null;
  relevance: string | null;
  informationNeeded: string | null;
  objectiveAlignment: string | null;
  priority: 'primary' | 'secondary' | 'supporting';
  origin: string;
  status: TopicStatus;
  sources: SourceRef[];
  requirements: TopicRequirement[];
  createdAt: string;
  updatedAt: string;
}

export interface BriefView {
  id: string;
  projectId: string;
  topicId: string;
  title: string;
  angle: string;
  audience: string;
  businessOutcome: string | null;
  outline: string | null;
  callToAction: string | null;
  destinationUrl: string | null;
  sources: SourceRef[];
  confirmations: string[];
  answers: TopicRequirement[];
  createdAt: string;
  updatedAt: string;
}

export interface DraftView {
  id: string;
  projectId: string;
  topicId: string;
  briefId: string | null;
  version: number;
  status: 'draft' | 'ready_for_review';
  title: string | null;
  excerpt: string | null;
  bodyMarkdown: string;
  slug: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  callToAction: string | null;
  sources: SourceRef[];
  unresolvedClaims: string[];
  generationRunId: string | null;
  /** Read-only gap resolution digest of the run that produced this version. */
  gapDigest: GapDigest | null;
  /** Read-only record of the links the run placed and dropped. */
  linkPlan: LinkPlan | null;
  savedAt: string | null;
  /** True when the brief or topic answers changed after this draft was generated. */
  stale: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentRunView {
  id: string;
  projectId: string;
  kind: ContentRunKind;
  topicId: string | null;
  draftId: string | null;
  status: ContentRunStatus;
  inputSnapshot: unknown;
  evidence: unknown;
  result: unknown;
  error: string | null;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  /** Present for article runs; null for topic runs and for runs predating it. */
  gapDigest: GapDigest | null;
  /** Present for article runs; null for topic runs and for runs predating it. */
  linkPlan: LinkPlan | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}
