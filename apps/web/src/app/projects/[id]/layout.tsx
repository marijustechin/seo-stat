'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getProject } from '@/entities/project/api';
import type { ProjectView } from '@/entities/project/model';
import { ApiError } from '@/shared/api/client';
import type { AppliedField } from '@/shared/config/suggestion-limits';
import { ProjectProvider } from '@/widgets/project-workspace/project-context';
import { ProjectHeader } from '@/widgets/project-workspace/project-header';
import { ProjectNav } from '@/widgets/project-workspace/project-nav';

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [project, setProject] = useState<ProjectView | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ revision: number; values: Partial<Record<AppliedField, string | null>> }>({
    revision: 0,
    values: {},
  });

  const notifyApplied = useCallback(
    (values: Partial<Record<AppliedField, string | null>>) => {
      setApplied((current) => ({ revision: current.revision + 1, values }));
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      const data = await getProject(id);
      setProject(data);
      setNotFound(false);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load project.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  if (loading && !project) {
    return (
      <p role="status" className="muted">
        Loading project…
      </p>
    );
  }

  if (notFound) {
    return (
      <div className="card">
        <h1>Project not found</h1>
        <p className="muted">This project does not exist or was removed.</p>
        <Link className="button cursor-pointer" href="/">
          Back to projects
        </Link>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="card status-error" role="alert">
        <p>{error}</p>
        <button type="button" className="button cursor-pointer" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <ProjectProvider value={{ project, refresh: load, applied, notifyApplied }}>
      <ProjectHeader project={project} />
      <ProjectNav projectId={project.id} />
      <div className="workspace-content">{children}</div>
    </ProjectProvider>
  );
}
