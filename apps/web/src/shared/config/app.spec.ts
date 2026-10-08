import { describe, expect, it } from 'vitest';
import {
  API_BASE_PATH,
  BASE_PATH,
  GLOBAL_NAV_ITEMS,
  PROJECT_SECTIONS,
  apiUrl,
  isActivePath,
  isGlobalNavActive,
  normalizedPath,
  projectSectionHref,
} from './app';

describe('app configuration', () => {
  it('uses the /seo-stat base path', () => {
    expect(BASE_PATH).toBe('/seo-stat');
    expect(API_BASE_PATH).toBe('/seo-stat/api');
  });

  it('builds same-origin API URLs under the prefix', () => {
    expect(apiUrl('/projects')).toBe('/seo-stat/api/projects');
  });

  it('never produces a duplicate prefix', () => {
    expect(apiUrl('/projects')).not.toContain('/seo-stat/seo-stat');
  });

  it('exposes global navigation and project sections', () => {
    expect(GLOBAL_NAV_ITEMS.map((item) => item.label)).toEqual(['Projects', 'System']);
    expect(PROJECT_SECTIONS.map((section) => section.label)).toEqual([
      'Overview',
      'Content',
      'Automation',
      'Run history',
      'Metrics & reports',
      'Settings',
    ]);
  });

  it('builds project section hrefs', () => {
    expect(projectSectionHref('abc', '')).toBe('/projects/abc');
    expect(projectSectionHref('abc', 'settings')).toBe('/projects/abc/settings');
  });

  it('normalizes paths and detects active navigation', () => {
    expect(normalizedPath('/seo-stat/projects/abc/')).toBe('/projects/abc');
    expect(isActivePath('/seo-stat/projects/abc/settings/', '/projects/abc/settings')).toBe(true);
    expect(isGlobalNavActive('/seo-stat/projects/abc/content', '/')).toBe(true);
    expect(isGlobalNavActive('/seo-stat/system', '/')).toBe(false);
    expect(isGlobalNavActive('/seo-stat/system', '/system')).toBe(true);
  });
});
