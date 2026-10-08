import { describe, expect, it } from 'vitest';
import { API_BASE_PATH, BASE_PATH, NAV_ITEMS, apiUrl, isActivePath } from './app';

describe('app configuration', () => {
  it('uses the /seo-stat base path', () => {
    expect(BASE_PATH).toBe('/seo-stat');
    expect(API_BASE_PATH).toBe('/seo-stat/api');
  });

  it('builds same-origin API URLs under the prefix', () => {
    expect(apiUrl('/health')).toBe('/seo-stat/api/health');
    expect(apiUrl('health')).toBe('/seo-stat/api/health');
  });

  it('never produces a duplicate prefix', () => {
    expect(apiUrl('/health')).not.toContain('/seo-stat/seo-stat');
  });

  it('exposes the three navigation entries', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(['Overview', 'Schedules', 'Run history']);
  });

  it('detects the active path with and without the base path', () => {
    expect(isActivePath('/seo-stat/', '/')).toBe(true);
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/seo-stat/schedules/', '/schedules')).toBe(true);
    expect(isActivePath('/seo-stat/runs/', '/schedules')).toBe(false);
  });
});
