export const BASE_PATH = '/seo-stat';
export const API_BASE_PATH = `${BASE_PATH}/api`;

export interface NavItem {
  href: string;
  label: string;
}

export const GLOBAL_NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Projects' },
  { href: '/system', label: 'System' },
];

export interface ProjectSection {
  key: string;
  label: string;
}

export const PROJECT_SECTIONS: readonly ProjectSection[] = [
  { key: '', label: 'Overview' },
  { key: 'content', label: 'Content' },
  { key: 'automation', label: 'Automation' },
  { key: 'runs', label: 'Run history' },
  { key: 'metrics', label: 'Metrics & reports' },
  { key: 'settings', label: 'Settings' },
];

export function projectSectionHref(projectId: string, key: string): string {
  return key ? `/projects/${projectId}/${key}` : `/projects/${projectId}`;
}

/** Pathname without the base path and without a trailing slash. */
export function normalizedPath(pathname: string): string {
  const withoutBase = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname;
  return withoutBase.replace(/\/+$/, '') || '/';
}

export function isActivePath(pathname: string, href: string): boolean {
  return normalizedPath(pathname) === href;
}

/** Global nav highlights the Projects area for any project route. */
export function isGlobalNavActive(pathname: string, href: string): boolean {
  const path = normalizedPath(pathname);
  if (href === '/') {
    return path === '/' || path === '/projects' || path.startsWith('/projects/');
  }
  return path === href || path.startsWith(`${href}/`);
}

export function apiUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_PATH}${clean}`;
}
