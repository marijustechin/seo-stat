'use client';

import { createContext, useContext } from 'react';
import type { ProjectView } from '@/entities/project/model';

export interface ProjectContextValue {
  project: ProjectView;
  refresh: () => Promise<void>;
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
