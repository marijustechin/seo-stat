export const PUBLISHING_POLICIES = ['review', 'automatic'] as const;
export type PublishingPolicy = (typeof PUBLISHING_POLICIES)[number];

export const PROJECT_STATUSES = ['active', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_LIST_FILTERS = ['active', 'archived', 'all'] as const;
export type ProjectListFilter = (typeof PROJECT_LIST_FILTERS)[number];

/** Public shape returned by the projects API. */
export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  businessContext: string | null;
  audience: string | null;
  objectives: string | null;
  contentLanguage: string;
  tone: string | null;
  timezone: string;
  publishingPolicy: PublishingPolicy;
  status: ProjectStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
