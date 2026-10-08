import type { ProjectStatus, ProjectView, PublishingPolicy } from './project.types.js';

/** Structural shape of a `projects` row as returned by Prisma. */
export interface ProjectRecord {
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
  publishingPolicy: string;
  status: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toProjectView(record: ProjectRecord): ProjectView {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    websiteUrl: record.websiteUrl,
    businessContext: record.businessContext,
    audience: record.audience,
    objectives: record.objectives,
    contentLanguage: record.contentLanguage,
    tone: record.tone,
    timezone: record.timezone,
    publishingPolicy: record.publishingPolicy as PublishingPolicy,
    status: record.status as ProjectStatus,
    archivedAt: record.archivedAt ? record.archivedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
