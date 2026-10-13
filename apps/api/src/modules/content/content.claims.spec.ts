import { describe, expect, it } from 'vitest';
import { guardArticleClaims } from './content.claims.js';
import type { ArticleOutput } from './content.schemas.js';

function article(overrides: Partial<ArticleOutput>): ArticleOutput {
  return {
    title: 'Neutral title',
    excerpt: 'Neutral excerpt',
    bodyMarkdown: '# Body',
    slug: 'neutral-title',
    seoTitle: 'Neutral SEO title',
    metaDescription: 'Neutral meta description',
    callToAction: 'Contact us',
    sources: [],
    unresolvedClaims: [],
    gapResolutions: [],
    ...overrides,
  };
}

describe('guardArticleClaims', () => {
  it('neutralizes an unsupported headline claim and records it', () => {
    const { output, notes } = guardArticleClaims(article({ title: 'Reuse, Recycling and Zero Landfill Explained' }));
    expect(output.title).not.toMatch(/zero[-\s]?landfill/i);
    expect(output.title).toMatch(/landfill diversion/i);
    expect(notes.length).toBeGreaterThan(0);
    expect(output.unresolvedClaims.some((claim) => /zero landfill/i.test(claim))).toBe(true);
  });

  it('neutralizes claims in SEO fields and the call to action', () => {
    const { output } = guardArticleClaims(
      article({
        seoTitle: 'Guaranteed 100% recycling',
        metaDescription: 'A carbon neutral, certified service',
        callToAction: 'Get guaranteed results',
      }),
    );
    expect(output.seoTitle).not.toMatch(/guaranteed|100\s?%/i);
    expect(output.metaDescription).not.toMatch(/carbon[-\s]?neutral|certified/i);
    expect(output.callToAction).not.toMatch(/guaranteed/i);
  });

  it('leaves neutral text unchanged', () => {
    const input = article({ title: 'How textile reuse and recycling work' });
    const { output, notes } = guardArticleClaims(input);
    expect(output.title).toBe(input.title);
    expect(notes).toHaveLength(0);
  });

  it('neutralizes an unsupported claim inside the article body', () => {
    const { output, neutralizations } = guardArticleClaims(
      article({ bodyMarkdown: '# Reuse\n\nOur process is zero landfill and fully certified.' }),
    );
    expect(output.bodyMarkdown).not.toMatch(/zero[-\s]?landfill|certified/i);
    expect(output.bodyMarkdown).toMatch(/landfill diversion/i);
    expect(neutralizations.some((item) => item.field === 'bodyMarkdown')).toBe(true);
  });

  it('records a structured neutralization for every guarded field it changed', () => {
    const { neutralizations } = guardArticleClaims(
      article({ title: 'Zero landfill promise', seoTitle: 'Certified 100% recycling' }),
    );
    const fields = neutralizations.map((item) => item.field);
    expect(fields).toContain('title');
    expect(fields).toContain('seoTitle');
    expect(neutralizations.every((item) => item.note.length > 0)).toBe(true);
  });
});
