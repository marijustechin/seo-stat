export const BASE_PATH = '/seo-stat';
export const API_BASE_PATH = `${BASE_PATH}/api`;

export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/schedules', label: 'Schedules' },
  { href: '/runs', label: 'Run history' },
];

export function isActivePath(pathname: string, href: string): boolean {
  const withoutBase = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname;
  const normalized = withoutBase.replace(/\/+$/, '') || '/';
  if (href === '/') {
    return normalized === '/';
  }
  return normalized === href;
}

export function apiUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_PATH}${clean}`;
}
