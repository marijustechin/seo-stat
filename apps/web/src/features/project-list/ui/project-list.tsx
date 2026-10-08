'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { listProjects } from '@/entities/project/api';
import type { ProjectListStatus, ProjectView } from '@/entities/project/model';
import { projectSectionHref } from '@/shared/config/app';
import { StatusBadge } from '@/shared/ui/status-badge';

export function ProjectList() {
  const [filter, setFilter] = useState<ProjectListStatus>('active');
  const [projects, setProjects] = useState<ProjectView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await listProjects(filter);
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  const selectFilter = (next: ProjectListStatus) => {
    if (next === filter) return;
    setLoading(true);
    setFilter(next);
  };

  const retry = () => {
    setLoading(true);
    void load();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="muted">
            Each project owns its content, workflows, schedules, history, metrics, and reports.
          </p>
        </div>
        <Link className="button cursor-pointer" href="/projects/new">
          New project
        </Link>
      </div>

      <div className="tabs">
        <button
          type="button"
          className="tab cursor-pointer"
          aria-pressed={filter === 'active'}
          onClick={() => selectFilter('active')}
        >
          Active
        </button>
        <button
          type="button"
          className="tab cursor-pointer"
          aria-pressed={filter === 'archived'}
          onClick={() => selectFilter('archived')}
        >
          Archived
        </button>
      </div>

      {loading && <p role="status" className="muted">Loading projects…</p>}

      {!loading && error && (
        <div className="card status-error" role="alert">
          <p>{error}</p>
          <button type="button" className="button cursor-pointer" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && projects && projects.length === 0 && (
        <div className="card empty">
          <p>{filter === 'archived' ? 'No archived projects.' : 'No projects yet.'}</p>
          {filter === 'active' && (
            <Link className="button cursor-pointer" href="/projects/new">
              Create your first project
            </Link>
          )}
        </div>
      )}

      {!loading && !error && projects && projects.length > 0 && (
        <ul className="project-grid">
          {projects.map((project) => (
            <li key={project.id} className="project-card">
              <div className="project-card-head">
                <Link href={projectSectionHref(project.id, '')}>{project.name}</Link>
                <StatusBadge status={project.status} />
              </div>
              {project.description && <p className="muted">{project.description}</p>}
              <dl className="meta">
                <div>
                  <dt>Website</dt>
                  <dd>{project.websiteUrl ?? 'Not set'}</dd>
                </div>
                <div>
                  <dt>Timezone</dt>
                  <dd>{project.timezone}</dd>
                </div>
                <div>
                  <dt>Publishing</dt>
                  <dd>{project.publishingPolicy === 'review' ? 'Review required' : 'Automatic'}</dd>
                </div>
              </dl>
              <Link className="button cursor-pointer" href={projectSectionHref(project.id, '')}>
                Open workspace
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
