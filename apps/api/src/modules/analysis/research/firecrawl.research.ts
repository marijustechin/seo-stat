import { Injectable, Logger } from '@nestjs/common';
import { ANALYSIS_LIMITS } from '../analysis.limits.js';
import type { AnalysisInputSnapshot } from '../analysis.types.js';
import type { PromptResearch } from '../ai/analysis.prompt.js';
import { SafeFetchError, validateUrlShape } from './safe-fetch.js';
import { scoreLink, type EvidenceFailure, type EvidencePage, type SiteKind } from './site-reader.js';
import { AnalysisResearch } from './research.port.js';

export const DEFAULT_FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev';

interface FirecrawlMetadata {
  title?: unknown;
  provider?: {
    creditsCost?: unknown;
    steps?: Array<{ creditsCost?: unknown }>;
  };
}

interface FirecrawlData {
  markdown?: unknown;
  links?: unknown;
  metadata?: FirecrawlMetadata;
}

interface FirecrawlResponse {
  success?: boolean;
  error?: unknown;
  data?: FirecrawlData;
}

interface ScrapeOutcome {
  markdown: string;
  title: string;
  links: string[];
  credits: number | null;
}

interface SiteCollection {
  pages: EvidencePage[];
  failures: EvidenceFailure[];
  credits: number | null;
}

function extractCredits(metadata: FirecrawlMetadata | undefined, header: string | null): number | null {
  if (header) {
    const parsed = Number.parseFloat(header);
    if (Number.isFinite(parsed)) return parsed;
  }
  const provider = metadata?.provider;
  if (provider && Number.isFinite(provider.creditsCost)) {
    return Number(provider.creditsCost);
  }
  if (Array.isArray(provider?.steps)) {
    let sum = 0;
    let found = false;
    for (const step of provider.steps) {
      if (Number.isFinite(step.creditsCost)) {
        sum += Number(step.creditsCost);
        found = true;
      }
    }
    if (found) return sum;
  }
  return null;
}

/**
 * Firecrawl-backed research. Firecrawl acquires clean Markdown for a bounded
 * selection of pages; it never runs an unrestricted full-domain crawl (we scrape
 * individual URLs only). We still validate every requested URL against the same
 * public-URL rules before sending it, because Firecrawl fetches from its own
 * network and our local DNS/IP protections do not govern its fetches.
 */
@Injectable()
export class FirecrawlResearchService extends AnalysisResearch {
  private readonly logger = new Logger(FirecrawlResearchService.name);
  private readonly apiKey: string | null;
  private readonly baseUrl: string;

  constructor() {
    super();
    this.apiKey = process.env.FIRECRAWL_API_KEY?.trim() || null;
    this.baseUrl = (process.env.FIRECRAWL_BASE_URL?.trim() || DEFAULT_FIRECRAWL_BASE_URL).replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  private async scrape(rawUrl: string): Promise<ScrapeOutcome> {
    if (!this.apiKey) throw new Error('Firecrawl is not configured.');
    // Enforce public-URL rules before asking Firecrawl to fetch.
    validateUrlShape(rawUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANALYSIS_LIMITS.requestTimeoutMs * 3);
    try {
      const response = await fetch(`${this.baseUrl}/v2/scrape`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url: rawUrl,
          formats: ['markdown', 'links'],
          onlyMainContent: true,
          timeout: ANALYSIS_LIMITS.requestTimeoutMs,
        }),
        signal: controller.signal,
      });
      const headerCredits = response.headers.get('x-credits-used');
      const payload = (await response.json().catch(() => null)) as FirecrawlResponse | null;
      if (!response.ok || !payload || payload.success === false) {
        const message =
          typeof payload?.error === 'string' ? payload.error : `Firecrawl HTTP ${response.status}`;
        throw new Error(message.slice(0, 200));
      }
      const data = payload.data ?? {};
      const markdown = typeof data.markdown === 'string' ? data.markdown : '';
      const title = typeof data.metadata?.title === 'string' ? data.metadata.title : '';
      const links = Array.isArray(data.links) ? data.links.filter((link): link is string => typeof link === 'string') : [];
      return { markdown, title, links, credits: extractCredits(data.metadata, headerCredits) };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async collectSite(
    rawBaseUrl: string,
    source: SiteKind,
    maxPages: number,
    budget: number,
  ): Promise<SiteCollection> {
    const failures: EvidenceFailure[] = [];
    let base: URL;
    try {
      base = validateUrlShape(rawBaseUrl);
    } catch (error) {
      const reason = error instanceof SafeFetchError ? error.message : 'Invalid URL.';
      return { pages: [], failures: [{ source, url: rawBaseUrl, reason }], credits: null };
    }

    let home: ScrapeOutcome;
    try {
      home = await this.scrape(base.toString());
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Firecrawl fetch failed.';
      return { pages: [], failures: [{ source, url: base.toString(), reason }], credits: null };
    }

    const pages: EvidencePage[] = [
      {
        source,
        url: base.toString(),
        title: home.title || base.toString(),
        fetchedAt: new Date().toISOString(),
        excerpt: home.markdown.slice(0, ANALYSIS_LIMITS.maxCharsPerPage),
      },
    ];
    let credits = home.credits;

    const limit = Math.min(maxPages, budget);
    if (limit > 1) {
      const candidates = home.links
        .filter((link) => {
          try {
            return new URL(link).hostname === base.hostname && link !== base.toString();
          } catch {
            return false;
          }
        })
        .map((link) => ({ link, score: scoreLink(link) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.link);

      for (const link of candidates) {
        if (pages.length >= limit) break;
        try {
          const page = await this.scrape(link);
          pages.push({
            source,
            url: link,
            title: page.title || link,
            fetchedAt: new Date().toISOString(),
            excerpt: page.markdown.slice(0, ANALYSIS_LIMITS.maxCharsPerPage),
          });
          if (page.credits !== null) credits = (credits ?? 0) + page.credits;
        } catch (error) {
          failures.push({
            source,
            url: link,
            reason: error instanceof Error ? error.message : 'Firecrawl fetch failed.',
          });
        }
      }
    }

    return { pages, failures, credits };
  }

  async collect(snapshot: AnalysisInputSnapshot): Promise<PromptResearch> {
    const pages: EvidencePage[] = [];
    const failures: EvidenceFailure[] = [];
    let credits: number | null = null;
    let budget = ANALYSIS_LIMITS.maxTotalPages;

    const merge = (collection: SiteCollection) => {
      pages.push(...collection.pages);
      failures.push(...collection.failures);
      budget -= collection.pages.length;
      if (collection.credits !== null) credits = (credits ?? 0) + collection.credits;
    };

    if (snapshot.websiteUrl) {
      merge(await this.collectSite(snapshot.websiteUrl, 'website', ANALYSIS_LIMITS.maxProjectPages, budget));
    }
    for (const url of snapshot.competitorUrls) {
      if (budget <= 0) break;
      merge(await this.collectSite(url, 'competitor', ANALYSIS_LIMITS.maxCompetitorPages, budget));
    }

    const websiteReadable = pages.some((page) => page.source === 'website');
    return { pages, failures, websiteReadable, backend: 'firecrawl', firecrawlCredits: credits };
  }
}
