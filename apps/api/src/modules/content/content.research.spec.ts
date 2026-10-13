import { describe, expect, it } from 'vitest';
import type { PromptResearch } from '../analysis/ai/analysis.prompt.js';
import type { EvidencePage } from '../analysis/research/site-reader.js';
import { CONTENT_LIMITS } from './content.limits.js';
import { applyResearchBudget } from './content.research.js';

function page(index: number, excerptLength = 100): EvidencePage {
  return {
    source: 'website',
    url: `https://example.test/page-${index}`,
    title: `Page ${index}`,
    fetchedAt: '2026-10-13T10:00:00.000Z',
    excerpt: 'x'.repeat(excerptLength),
  };
}

function research(pages: EvidencePage[]): PromptResearch {
  return { pages, failures: [], websiteReadable: true, backend: 'direct', firecrawlCredits: null };
}

describe('applyResearchBudget', () => {
  it('caps the number of pages used by one article run', () => {
    const pages = Array.from({ length: CONTENT_LIMITS.researchMaxPages + 4 }, (_, index) => page(index));
    const { research: budgeted, budget } = applyResearchBudget(research(pages));

    expect(budgeted.pages).toHaveLength(CONTENT_LIMITS.researchMaxPages);
    expect(budget.usedPages).toBe(CONTENT_LIMITS.researchMaxPages);
    expect(budget.droppedPages).toBe(4);
    expect(budget.maxPages).toBe(CONTENT_LIMITS.researchMaxPages);
  });

  it('caps the total characters sent to the model', () => {
    const pages = Array.from({ length: 8 }, (_, index) => page(index, 10_000));
    const { research: budgeted, budget } = applyResearchBudget(research(pages));

    const total = budgeted.pages.reduce((sum, item) => sum + item.excerpt.length, 0);
    expect(total).toBeLessThanOrEqual(CONTENT_LIMITS.researchMaxInputChars);
    expect(budget.usedInputChars).toBe(total);
    expect(budget.maxInputChars).toBe(CONTENT_LIMITS.researchMaxInputChars);
    expect(budget.droppedPages).toBeGreaterThan(0);
  });

  it('keeps research intact when it is already within budget', () => {
    const pages = [page(0, 50), page(1, 50)];
    const { research: budgeted, budget } = applyResearchBudget(research(pages));

    expect(budgeted.pages.map((item) => item.url)).toEqual(pages.map((item) => item.url));
    expect(budget.droppedPages).toBe(0);
    expect(budget.usedPages).toBe(2);
  });

  it('preserves the backend, failures and readability of the run', () => {
    const input: PromptResearch = {
      pages: [page(0)],
      failures: [{ source: 'website', url: 'https://example.test/gone', reason: 'Fetch failed.' }],
      websiteReadable: false,
      backend: 'firecrawl',
      firecrawlCredits: 3,
    };
    const { research: budgeted } = applyResearchBudget(input);

    expect(budgeted.backend).toBe('firecrawl');
    expect(budgeted.firecrawlCredits).toBe(3);
    expect(budgeted.failures).toHaveLength(1);
    expect(budgeted.websiteReadable).toBe(false);
  });
});
