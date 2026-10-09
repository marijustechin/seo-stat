export interface SourceRef {
  url: string;
  note: string;
  retrievedAt?: string;
}

export interface ContentTopic {
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
  status: 'suggested' | 'selected' | 'dismissed';
  sources: SourceRef[];
  createdAt: string;
  updatedAt: string;
}

export interface TopicBrief {
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

export interface ArticleDraft {
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

export interface ContentRun {
  id: string;
  projectId: string;
  kind: 'topics' | 'article';
  topicId: string | null;
  draftId: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'interrupted';
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

export interface TopicInput {
  title: string;
  audience: string;
  objective: string;
  angle: string;
  readerNeed?: string | null;
  callToAction?: string | null;
  relevance?: string | null;
  informationNeeded?: string | null;
  objectiveAlignment?: string | null;
  priority?: 'primary' | 'secondary' | 'supporting';
}

export interface BriefInput {
  title?: string;
  angle?: string;
  audience?: string;
  businessOutcome?: string | null;
  outline?: string | null;
  callToAction?: string | null;
  destinationUrl?: string | null;
  sources?: SourceRef[];
  confirmations?: string[];
}

export interface DraftInput {
  title?: string | null;
  excerpt?: string | null;
  bodyMarkdown?: string;
  slug?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  callToAction?: string | null;
  unresolvedClaims?: string[];
  expectedUpdatedAt?: string;
}
