export const CONTENT_RUN_KINDS = ['topics', 'article'] as const;
export type ContentRunKind = (typeof CONTENT_RUN_KINDS)[number];

export const CONTENT_RUN_STATUSES = ['queued', 'running', 'completed', 'failed', 'interrupted'] as const;
export type ContentRunStatus = (typeof CONTENT_RUN_STATUSES)[number];

export const TOPIC_STATUSES = ['suggested', 'selected', 'dismissed'] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const TOPIC_PRIORITIES = ['primary', 'secondary', 'supporting'] as const;
export type TopicPriority = (typeof TOPIC_PRIORITIES)[number];

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
  savedAt: string | null;
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
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}
