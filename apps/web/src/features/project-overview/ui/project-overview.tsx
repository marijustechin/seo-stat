'use client';

import Link from 'next/link';
import { projectSectionHref } from '@/shared/config/app';
import { NotImplemented } from '@/shared/ui/not-implemented';
import { useProject } from '@/widgets/project-workspace/project-context';

export function ProjectOverview() {
  const { project } = useProject();

  return (
    <>
      <h1>Overview</h1>
      <p className="muted">Workspace for {project.name}.</p>

      <section className="card" aria-labelledby="summary-title">
        <h2 id="summary-title">Summary</h2>
        <dl className="details">
          <div>
            <dt>Website</dt>
            <dd>
              {project.websiteUrl ? (
                <a href={project.websiteUrl} target="_blank" rel="noreferrer">
                  {project.websiteUrl}
                </a>
              ) : (
                <span className="muted">Not set</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Timezone</dt>
            <dd>{project.timezone}</dd>
          </div>
          <div>
            <dt>Publishing policy</dt>
            <dd>{project.publishingPolicy === 'review' ? 'Review required' : 'Automatic'}</dd>
          </div>
          <div>
            <dt>Content language</dt>
            <dd>{project.contentLanguage}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{project.status === 'archived' ? 'Archived' : 'Active'}</dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-labelledby="sections-title">
        <h2 id="sections-title">Sections</h2>
        <ul className="link-list">
          <li>
            <Link href={projectSectionHref(project.id, 'settings')}>Settings</Link> — name, business
            context, content rules, and publishing policy.
          </li>
          <li>
            <Link href={projectSectionHref(project.id, 'content')}>Content</Link> — not implemented
            yet.
          </li>
          <li>
            <Link href={projectSectionHref(project.id, 'automation')}>Automation</Link> — not
            implemented yet.
          </li>
          <li>
            <Link href={projectSectionHref(project.id, 'runs')}>Run history</Link> — not implemented
            yet.
          </li>
          <li>
            <Link href={projectSectionHref(project.id, 'metrics')}>Metrics &amp; reports</Link> — not
            implemented yet.
          </li>
        </ul>
      </section>

      <NotImplemented
        title="Not implemented yet"
        description="This project has no content, automation, executions, or reports yet. Nothing is generated or published by this application at this stage."
      />
    </>
  );
}
