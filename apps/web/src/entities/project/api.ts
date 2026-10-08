import { apiFetch } from '@/shared/api/client';
import type {
  ProjectInput,
  ProjectListStatus,
  ProjectSettingsInput,
  ProjectView,
} from './model';

function idPath(id: string): string {
  return `/projects/${encodeURIComponent(id)}`;
}

export function listProjects(status: ProjectListStatus = 'active'): Promise<ProjectView[]> {
  return apiFetch<ProjectView[]>(`/projects?status=${status}`);
}

export function getProject(id: string): Promise<ProjectView> {
  return apiFetch<ProjectView>(idPath(id));
}

export function createProject(input: ProjectInput): Promise<ProjectView> {
  return apiFetch<ProjectView>('/projects', { method: 'POST', body: JSON.stringify(input) });
}

export function updateProject(id: string, input: ProjectInput): Promise<ProjectView> {
  return apiFetch<ProjectView>(idPath(id), { method: 'PATCH', body: JSON.stringify(input) });
}

export function updateProjectSettings(
  id: string,
  input: ProjectSettingsInput,
): Promise<ProjectView> {
  return apiFetch<ProjectView>(`${idPath(id)}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function archiveProject(id: string): Promise<ProjectView> {
  return apiFetch<ProjectView>(`${idPath(id)}/archive`, { method: 'POST' });
}

export function restoreProject(id: string): Promise<ProjectView> {
  return apiFetch<ProjectView>(`${idPath(id)}/restore`, { method: 'POST' });
}
