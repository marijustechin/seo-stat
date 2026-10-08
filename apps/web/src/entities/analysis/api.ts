import { apiFetch } from '@/shared/api/client';
import type { AnalysisRunView } from './model';

function base(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/analysis`;
}

export interface ApplyAnalysisInput {
  acknowledgeConflict?: boolean;
  businessContext?: boolean;
  audience?: boolean;
  objectives?: boolean;
  tone?: boolean;
  businessContextValue?: string;
  audienceValue?: string;
  objectivesValue?: string;
  toneValue?: string;
}

export function listAnalyses(projectId: string): Promise<AnalysisRunView[]> {
  return apiFetch<AnalysisRunView[]>(base(projectId));
}

export function startAnalysis(projectId: string): Promise<AnalysisRunView> {
  return apiFetch<AnalysisRunView>(base(projectId), { method: 'POST' });
}

export function applyAnalysis(
  projectId: string,
  runId: string,
  input: ApplyAnalysisInput,
): Promise<AnalysisRunView> {
  return apiFetch<AnalysisRunView>(`${base(projectId)}/${encodeURIComponent(runId)}/apply`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
