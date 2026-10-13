import { describe, expect, it } from 'vitest';
import { CONTENT_LIMITS } from './content.limits.js';
import {
  applyLinkPolicy,
  buildLinkCandidates,
  normalizePath,
  type LinkPolicyInput,
} from './content.links.js';

const ORIGIN = 'https://example.com';

function policy(overrides: Partial<LinkPolicyInput> = {}): LinkPolicyInput {
  return {
    origin: ORIGIN,
    allowedPaths: ['/wholesale', '/contacts'],
    allowedExternal: [],
    source: 'sitemap',
    candidates: 2,
    truncated: 0,
    ...overrides,
  };
}

function body(...links: string[]): string {
  return `# Article\n\n${links.join(' ')}`;
}

describe('normalizePath', () => {
  it('strips a trailing slash and guarantees a leading one', () => {
    expect(normalizePath('/wholesale/')).toBe('/wholesale');
    expect(normalizePath('wholesale')).toBe('/wholesale');
  });
});

describe('buildLinkCandidates', () => {
  it('prefers the sitemap and reports where the list came from', () => {
    const result = buildLinkCandidates(
      ORIGIN,
      [`${ORIGIN}/wholesale`, `${ORIGIN}/contacts`],
      [`${ORIGIN}/ignored`],
    );
    expect(result.source).toBe('sitemap');
    // Same depth, so the list is ordered alphabetically.
    expect(result.paths).toEqual(['/contacts', '/wholesale']);
    expect(result.origin).toBe(ORIGIN);
  });

  it('falls back to the pages the research already retrieved', () => {
    const result = buildLinkCandidates(ORIGIN, [], [`${ORIGIN}/collection`]);
    expect(result.source).toBe('research');
    expect(result.paths).toEqual(['/collection']);
  });

  it('offers nothing when no website is configured', () => {
    const result = buildLinkCandidates(null, [`${ORIGIN}/wholesale`], []);
    expect(result.source).toBe('none');
    expect(result.paths).toEqual([]);
    expect(result.origin).toBeNull();
  });

  it('keeps only the project own pages', () => {
    const result = buildLinkCandidates(ORIGIN, ['https://elsewhere.test/wholesale'], []);
    expect(result.paths).toEqual([]);
  });

  it('drops paths that are never useful link targets', () => {
    const result = buildLinkCandidates(
      ORIGIN,
      [
        `${ORIGIN}/wp-json/wp/v2/pages`,
        `${ORIGIN}/tag/reuse`,
        `${ORIGIN}/author/ana`,
        `${ORIGIN}/search/textiles`,
        `${ORIGIN}/page/2`,
        `${ORIGIN}/2026/10/archive-post`,
        `${ORIGIN}/feed/`,
        `${ORIGIN}/wholesale`,
      ],
      [],
    );
    expect(result.paths).toEqual(['/wholesale']);
  });

  it('deduplicates and normalizes trailing slashes', () => {
    const result = buildLinkCandidates(ORIGIN, [`${ORIGIN}/wholesale/`, `${ORIGIN}/wholesale`], []);
    expect(result.paths).toEqual(['/wholesale']);
  });

  it('puts shallower paths first and caps how many reach the prompt', () => {
    const deep = Array.from({ length: CONTENT_LIMITS.linkCandidates + 5 }, (_v, index) => `${ORIGIN}/a/b/c/d-${index}`);
    const result = buildLinkCandidates(ORIGIN, [`${ORIGIN}/wholesale`, ...deep], []);
    expect(result.paths[0]).toBe('/wholesale');
    expect(result.paths).toHaveLength(CONTENT_LIMITS.linkCandidates);
    expect(result.truncated).toBe(result.total - CONTENT_LIMITS.linkCandidates);
    expect(result.total).toBe(CONTENT_LIMITS.linkCandidates + 6);
  });

  it('ignores entries that are not usable URLs', () => {
    const result = buildLinkCandidates(ORIGIN, ['', 'javascript:void(0)', `${ORIGIN}/wholesale`], []);
    expect(result.paths).toEqual(['/wholesale']);
  });
});

describe('applyLinkPolicy', () => {
  it('keeps an internal link whose page is in the project list', () => {
    const { bodyMarkdown, plan } = applyLinkPolicy(
      body('See our [wholesale service](/wholesale) for details.'),
      policy(),
    );
    expect(bodyMarkdown).toContain('[wholesale service](/wholesale)');
    expect(plan.internal.map((entry) => entry.url)).toEqual(['/wholesale']);
    expect(plan.dropped).toHaveLength(0);
  });

  it('removes an invented internal link but keeps its anchor text', () => {
    const { bodyMarkdown, plan } = applyLinkPolicy(
      body('See our [wholesale service](/wholesale-page-we-never-had).'),
      policy(),
    );
    expect(bodyMarkdown).not.toContain('](');
    expect(bodyMarkdown).toContain('wholesale service');
    expect(plan.internal).toHaveLength(0);
    expect(plan.dropped).toHaveLength(1);
    expect(plan.dropped[0]?.kind).toBe('internal');
    expect(plan.dropped[0]?.reason).toMatch(/project URL list/i);
  });

  it('keeps an external link that was retrieved during the run', () => {
    const { bodyMarkdown, plan } = applyLinkPolicy(
      body('According to [WRAP](https://wrap.test/textiles), reuse is growing.'),
      policy({ allowedExternal: ['https://wrap.test/textiles'] }),
    );
    expect(bodyMarkdown).toContain('](https://wrap.test/textiles)');
    expect(plan.external).toHaveLength(1);
  });

  it('matches an external source despite a trailing slash difference', () => {
    const { plan } = applyLinkPolicy(
      body('Source: [report](https://wrap.test/report/).'),
      policy({ allowedExternal: ['https://wrap.test/report'] }),
    );
    expect(plan.external).toHaveLength(1);
    expect(plan.dropped).toHaveLength(0);
  });

  it('removes an external link that was never retrieved', () => {
    const { bodyMarkdown, plan } = applyLinkPolicy(
      body('Facts from [a made up study](https://invented.test/study).'),
      policy({ allowedExternal: [] }),
    );
    expect(bodyMarkdown).not.toContain('](');
    expect(bodyMarkdown).toContain('a made up study');
    expect(plan.dropped).toHaveLength(1);
    expect(plan.dropped[0]?.kind).toBe('external');
    expect(plan.dropped[0]?.reason).toMatch(/not retrieved/i);
  });

  it('cannot verify a relative link when no website is configured', () => {
    const { bodyMarkdown, plan } = applyLinkPolicy(
      body('See [contacts](/contacts).'),
      policy({ origin: null, allowedPaths: ['/contacts'] }),
    );
    expect(bodyMarkdown).not.toContain('](');
    expect(plan.dropped).toHaveLength(1);
  });

  it('leaves images, mail links, telephone links and fragments untouched', () => {
    const input = body(
      '![cover](/cover.png)',
      '[email us](mailto:hi@example.com)',
      '[call us](tel:+37060000000)',
      '[jump](#details)',
    );
    const { bodyMarkdown, plan } = applyLinkPolicy(input, policy());
    expect(bodyMarkdown).toBe(input);
    expect(plan.dropped).toHaveLength(0);
    expect(plan.internal).toHaveLength(0);
  });

  it('enforces the internal and external caps and records the overflow', () => {
    const paths = Array.from({ length: CONTENT_LIMITS.linkMaxInternal + 2 }, (_v, index) => `/page-${index}`);
    const externals = Array.from({ length: CONTENT_LIMITS.linkMaxExternal + 1 }, (_v, index) => `https://source${index}.test/a`);
    const { plan } = applyLinkPolicy(
      body(
        ...paths.map((path, index) => `[p${index}](${path})`),
        ...externals.map((url, index) => `[s${index}](${url})`),
      ),
      policy({ allowedPaths: paths, allowedExternal: externals }),
    );
    expect(plan.internal).toHaveLength(CONTENT_LIMITS.linkMaxInternal);
    expect(plan.external).toHaveLength(CONTENT_LIMITS.linkMaxExternal);
    expect(plan.dropped).toHaveLength(3);
    expect(plan.dropped.every((entry) => /cap/i.test(entry.reason))).toBe(true);
  });

  it('returns an unchanged body when there are no links', () => {
    const input = '# Article\n\nPlain text without links.';
    const { bodyMarkdown, plan } = applyLinkPolicy(input, policy());
    expect(bodyMarkdown).toBe(input);
    expect(plan.internal).toHaveLength(0);
    expect(plan.external).toHaveLength(0);
    expect(plan.dropped).toHaveLength(0);
  });

  it('carries the source, candidate count and truncation into the record', () => {
    const { plan } = applyLinkPolicy(body('text'), policy({ source: 'research', candidates: 7, truncated: 3 }));
    expect(plan.source).toBe('research');
    expect(plan.candidates).toBe(7);
    expect(plan.truncated).toBe(3);
  });
});
