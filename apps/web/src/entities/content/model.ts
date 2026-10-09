export interface SourceRef {
  url: string;
  note: string;
  retrievedAt?: string;
}

export interface TopicRequirement {
  id: string;
  question: string;
  answer: string | null;
  sourceUrl: string | null;
  state: 'unanswered' | 'answered' | 'unknown' | 'exclude';
}

export interface ProjectKnowledge {
  id: string;
  projectId: string;
  text: string;
  originQuestion: string | null;
  originTopicId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleImage {
  id: string;
  projectId: string;
  draftId: string | null;
  version: number;
  kind: 'generated' | 'uploaded';
  status: 'ready' | 'failed' | 'unavailable';
  prompt: string | null;
  altText: string | null;
  provider: string | null;
  model: string | null;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  usage: unknown;
  selected: boolean;
  error: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
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
  requirements: TopicRequirement[];
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
  answers: TopicRequirement[];
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
  stale: boolean;
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
  requirements?: TopicRequirement[];
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
  answers?: TopicRequirement[];
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
