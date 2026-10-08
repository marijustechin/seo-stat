export type ProjectStatus = 'active' | 'archived';
export type PublishingPolicy = 'review' | 'automatic';
export type ProjectListStatus = 'active' | 'archived';

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
  competitorUrls: string[];
  status: ProjectStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  websiteUrl?: string | null;
}

export interface ProjectSettingsInput {
  businessContext?: string | null;
  audience?: string | null;
  objectives?: string | null;
  contentLanguage?: string;
  tone?: string | null;
  timezone?: string;
  publishingPolicy?: PublishingPolicy;
  competitorUrls?: string[];
}
