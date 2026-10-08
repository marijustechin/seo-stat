import { describe, expect, it } from 'vitest';
import { normalizeCompetitorUrls } from './competitor-urls.js';

describe('normalizeCompetitorUrls', () => {
  it('trims, drops blanks, strips trailing slashes, and de-duplicates', () => {
    expect(
      normalizeCompetitorUrls([
        ' https://a.example/ ',
        '',
        'https://a.example',
        'https://b.example',
      ]),
    ).toEqual(['https://a.example', 'https://b.example']);
  });

  it('returns undefined when the field is not provided', () => {
    expect(normalizeCompetitorUrls(undefined)).toBeUndefined();
  });
});
