import { apiFetch } from '@/shared/api/client';
import type { DraftExport, WordpressIntegration, WordpressIntegrationInput } from './model';

function integrationPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/integrations/wordpress`;
}

function exportPath(projectId: string, draftId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/content/drafts/${encodeURIComponent(draftId)}/wordpress`;
}

export function getWordpressIntegration(projectId: string): Promise<WordpressIntegration> {
  return apiFetch<WordpressIntegration>(integrationPath(projectId));
}

export function saveWordpressIntegration(
  projectId: string,
  input: WordpressIntegrationInput,
): Promise<WordpressIntegration> {
  return apiFetch<WordpressIntegration>(integrationPath(projectId), {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function testWordpressIntegration(projectId: string): Promise<WordpressIntegration> {
  return apiFetch<WordpressIntegration>(`${integrationPath(projectId)}/test`, { method: 'POST' });
}

export function disconnectWordpress(projectId: string): Promise<WordpressIntegration> {
  return apiFetch<WordpressIntegration>(integrationPath(projectId), { method: 'DELETE' });
}

export function getDraftExport(projectId: string, draftId: string): Promise<DraftExport> {
  return apiFetch<DraftExport>(exportPath(projectId, draftId));
}

export function exportDraftToWordpress(
  projectId: string,
  draftId: string,
  input: { expectedUpdatedAt?: string },
): Promise<DraftExport> {
  return apiFetch<DraftExport>(`${exportPath(projectId, draftId)}/export`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function reconcileDraftExport(projectId: string, draftId: string): Promise<DraftExport> {
  return apiFetch<DraftExport>(`${exportPath(projectId, draftId)}/reconcile`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
