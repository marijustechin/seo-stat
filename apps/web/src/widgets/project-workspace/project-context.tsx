'use client';

import { createContext, useContext } from 'react';
import type { ProjectView } from '@/entities/project/model';
import type { AppliedField } from '@/shared/config/suggestion-limits';

export interface AppliedPatch {
  revision: number;
  values: Partial<Record<AppliedField, string | null>>;
}

export interface ProjectContextValue {
  project: ProjectView;
  refresh: () => Promise<void>;
  /** Signals the Settings form to sync applied values without discarding edits. */
  applied: AppliedPatch;
  notifyApplied: (values: Partial<Record<AppliedField, string | null>>) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export const ProjectProvider = ProjectContext.Provider;

export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) {
    throw new Error('useProject must be used inside the project workspace layout.');
  }
  return value;
}
