'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PROJECT_SECTIONS, isActivePath, projectSectionHref } from '@/shared/config/app';

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <nav className="section-nav" aria-label="Project sections">
      <ul>
        {PROJECT_SECTIONS.map((section) => {
          const href = projectSectionHref(projectId, section.key);
          return (
            <li key={section.key || 'overview'}>
              <Link href={href} aria-current={isActivePath(pathname, href) ? 'page' : undefined}>
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
