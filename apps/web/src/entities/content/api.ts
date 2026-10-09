import { apiFetch } from '@/shared/api/client';
import type {
  ArticleDraft,
  ArticleImage,
  BriefInput,
  ContentRun,
  ContentTopic,
  DraftInput,
  ProjectKnowledge,
  TopicBrief,
  TopicInput,
} from './model';

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

export const listKnowledge = (projectId: string) =>
  apiFetch<ProjectKnowledge[]>(`${base(projectId)}/knowledge`);
export const createKnowledge = (
  projectId: string,
  input: { text: string; originQuestion?: string | null; originTopicId?: string | null },
) => apiFetch<ProjectKnowledge>(`${base(projectId)}/knowledge`, { method: 'POST', body: JSON.stringify(input) });
export const updateKnowledge = (projectId: string, knowledgeId: string, text: string) =>
  apiFetch<ProjectKnowledge>(`${base(projectId)}/knowledge/${encodeURIComponent(knowledgeId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ text }),
  });
export const deleteKnowledge = (projectId: string, knowledgeId: string) =>
  apiFetch<{ ok: true }>(`${base(projectId)}/knowledge/${encodeURIComponent(knowledgeId)}`, { method: 'DELETE' });

export const listImages = (projectId: string, draftId: string) =>
  apiFetch<ArticleImage[]>(`${base(projectId)}/drafts/${encodeURIComponent(draftId)}/images`);
export const generateImage = (projectId: string, draftId: string, input: { prompt?: string; altText?: string }) =>
  apiFetch<ArticleImage>(`${base(projectId)}/drafts/${encodeURIComponent(draftId)}/images/generate`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const uploadImage = (
  projectId: string,
  draftId: string,
  input: { dataBase64: string; fileName: string; mimeType: string; altText?: string },
) =>
  apiFetch<ArticleImage>(`${base(projectId)}/drafts/${encodeURIComponent(draftId)}/images/upload`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const updateImage = (projectId: string, imageId: string, input: { altText?: string; prompt?: string }) =>
  apiFetch<ArticleImage>(`${base(projectId)}/images/${encodeURIComponent(imageId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const selectImage = (projectId: string, imageId: string) =>
  apiFetch<ArticleImage>(`${base(projectId)}/images/${encodeURIComponent(imageId)}/select`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
