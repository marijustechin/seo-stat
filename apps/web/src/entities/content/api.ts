import { apiFetch } from '@/shared/api/client';
import type { ArticleDraft, BriefInput, ContentRun, ContentTopic, DraftInput, TopicBrief, TopicInput } from './model';

function base(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/content`;
}

export const listTopics = (projectId: string) => apiFetch<ContentTopic[]>(`${base(projectId)}/topics`);
export const generateTopics = (projectId: string) =>
  apiFetch<ContentRun>(`${base(projectId)}/topics/generate`, { method: 'POST' });
export const createTopic = (projectId: string, input: TopicInput) =>
  apiFetch<ContentTopic>(`${base(projectId)}/topics`, { method: 'POST', body: JSON.stringify(input) });
export const updateTopic = (projectId: string, topicId: string, input: Partial<TopicInput>) =>
  apiFetch<ContentTopic>(`${base(projectId)}/topics/${encodeURIComponent(topicId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const dismissTopic = (projectId: string, topicId: string) =>
  apiFetch<ContentTopic>(`${base(projectId)}/topics/${encodeURIComponent(topicId)}/dismiss`, { method: 'POST' });
export const getBrief = (projectId: string, topicId: string) =>
  apiFetch<TopicBrief>(`${base(projectId)}/topics/${encodeURIComponent(topicId)}/brief`);
export const saveBrief = (projectId: string, topicId: string, input: BriefInput) =>
  apiFetch<TopicBrief>(`${base(projectId)}/topics/${encodeURIComponent(topicId)}/brief`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
export const generateDraft = (projectId: string, topicId: string) =>
  apiFetch<ContentRun>(`${base(projectId)}/topics/${encodeURIComponent(topicId)}/draft`, { method: 'POST' });
export const listDrafts = (projectId: string) => apiFetch<ArticleDraft[]>(`${base(projectId)}/drafts`);
export const getDraft = (projectId: string, draftId: string) =>
  apiFetch<ArticleDraft>(`${base(projectId)}/drafts/${encodeURIComponent(draftId)}`);
export const saveDraft = (projectId: string, draftId: string, input: DraftInput) =>
  apiFetch<ArticleDraft>(`${base(projectId)}/drafts/${encodeURIComponent(draftId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const markDraftReady = (projectId: string, draftId: string) =>
  apiFetch<ArticleDraft>(`${base(projectId)}/drafts/${encodeURIComponent(draftId)}/ready`, { method: 'POST' });
export const listContentRuns = (projectId: string) => apiFetch<ContentRun[]>(`${base(projectId)}/runs`);
