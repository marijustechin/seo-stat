export type AnalysisStatus = 'queued' | 'running' | 'completed' | 'failed' | 'interrupted';
export type SuggestionOrigin = 'user' | 'website' | 'competitor' | 'inference';

export interface SuggestionSource {
  url: string;
  note: string;
}

export interface Suggestion {
  value: string;
  origin: SuggestionOrigin;
  confidence: string;
  sources: SuggestionSource[];
  rationale: string;
}

export interface AudienceSegment {
  name: string;
  needs: string;
  offering: string;
  desiredAction: string;
  contentDirections: string[];
  origin: SuggestionOrigin;
  confidence: string;
  sources: SuggestionSource[];
}

export interface ContentTheme {
  theme: string;
  rationale: string;
  origin: SuggestionOrigin;
  sources: SuggestionSource[];
}

export interface MissingInformation {
  question: string;
  why: string;
}

export interface AnalysisResult {
  businessContext: Suggestion;
  audienceSegments: AudienceSegment[];
  objectives: Suggestion;
  tone: Suggestion;
  contentThemes: ContentTheme[];
  missingInformation: MissingInformation[];
}

export interface EvidencePage {
  source: string;
  url: string;
  title: string;
  fetchedAt: string;
  excerpt: string;
}

export interface EvidenceFailure {
  source: string;
  url: string;
  reason: string;
}

export interface AnalysisEvidence {
  pages: EvidencePage[];
  failures: EvidenceFailure[];
  websiteReadable: boolean;
}

export interface AnalysisInputSnapshot {
  websiteUrl: string | null;
  competitorUrls: string[];
  businessContext: string | null;
  audience: string | null;
  objectives: string | null;
  tone: string | null;
  contentLanguage: string;
  projectUpdatedAt: string;
  capturedAt: string;
}

export interface AnalysisRunView {
  id: string;
  projectId: string;
  status: AnalysisStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  error: string | null;
  conflict: boolean;
  appliedAt: string | null;
  appliedFields: string[];
  inputSnapshot: AnalysisInputSnapshot;
  evidence: AnalysisEvidence | null;
  result: AnalysisResult | null;
}
