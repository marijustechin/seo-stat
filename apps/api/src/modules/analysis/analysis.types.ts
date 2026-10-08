export const ANALYSIS_STATUSES = ['queued', 'running', 'completed', 'failed', 'interrupted'] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

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
  evidence: unknown;
  result: unknown;
}
