import Link from 'next/link';
import { StatusBadge } from '@/shared/ui/status-badge';
import type { ProjectView } from '@/entities/project/model';

export function ProjectHeader({ project }: { project: ProjectView }) {
  return (
    <div className="project-header">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Projects</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{project.name}</span>
      </nav>
      <div className="project-title">
        <h1>{project.name}</h1>
        <StatusBadge status={project.status} />
      </div>
      {project.websiteUrl ? (
        <a className="muted" href={project.websiteUrl} target="_blank" rel="noreferrer">
          {project.websiteUrl}
        </a>
      ) : (
        <span className="muted">No website set</span>
      )}
    </div>
  );
}
