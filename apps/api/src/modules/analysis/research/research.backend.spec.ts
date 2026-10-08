import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisInputSnapshot } from '../analysis.types.js';
import type { PromptResearch } from '../ai/analysis.prompt.js';
import { FirecrawlResearchService } from './firecrawl.research.js';
import { ResearchCoordinator, SiteResearchService } from './research.service.js';

const snapshot: AnalysisInputSnapshot = {
  websiteUrl: 'https://example.com',
  competitorUrls: [],
  businessContext: null,
  audience: null,
  objectives: null,
  tone: null,
  contentLanguage: 'en',
  projectUpdatedAt: '2026-01-01T00:00:00.000Z',
  capturedAt: '2026-01-01T00:00:00.000Z',
};

function result(backend: 'direct' | 'firecrawl'): PromptResearch {
  return {
    pages: [],
    failures: [],
    websiteReadable: false,
    backend,
    firecrawlCredits: backend === 'firecrawl' ? 1 : null,
  };
}

describe('FirecrawlResearchService configuration', () => {
  const original = process.env.FIRECRAWL_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = original;
  });

  it('is unconfigured without FIRECRAWL_API_KEY and configured with it', () => {
    delete process.env.FIRECRAWL_API_KEY;
    expect(new FirecrawlResearchService().isConfigured()).toBe(false);
    process.env.FIRECRAWL_API_KEY = 'test-key';
    expect(new FirecrawlResearchService().isConfigured()).toBe(true);
  });
});

describe('ResearchCoordinator backend selection', () => {
  it('prefers Firecrawl when configured', async () => {
    const direct = { collect: vi.fn().mockResolvedValue(result('direct')) } as unknown as SiteResearchService;
    const firecrawl = {
      isConfigured: () => true,
      collect: vi.fn().mockResolvedValue(result('firecrawl')),
    } as unknown as FirecrawlResearchService;

    const coordinator = new ResearchCoordinator(direct, firecrawl);
    expect(coordinator.firecrawlConfigured()).toBe(true);
    const outcome = await coordinator.collect(snapshot);
    expect(outcome.backend).toBe('firecrawl');
    expect(direct.collect).not.toHaveBeenCalled();
  });

  it('falls back to the direct backend when Firecrawl is absent', async () => {
    const direct = { collect: vi.fn().mockResolvedValue(result('direct')) } as unknown as SiteResearchService;
    const firecrawl = {
      isConfigured: () => false,
      collect: vi.fn(),
    } as unknown as FirecrawlResearchService;

    const coordinator = new ResearchCoordinator(direct, firecrawl);
    expect(coordinator.firecrawlConfigured()).toBe(false);
    const outcome = await coordinator.collect(snapshot);
    expect(outcome.backend).toBe('direct');
    expect(firecrawl.collect).not.toHaveBeenCalled();
  });
});
