import { Injectable } from '@nestjs/common';
import { ANALYSIS_LIMITS } from '../analysis.limits.js';
import type { AnalysisInputSnapshot } from '../analysis.types.js';
import type { PromptResearch } from '../ai/analysis.prompt.js';
import { readSite, type EvidenceFailure, type EvidencePage } from './site-reader.js';

/** Research boundary; tests provide a fixture implementation instead of network. */
export abstract class AnalysisResearch {
  abstract collect(snapshot: AnalysisInputSnapshot): Promise<PromptResearch>;
}

function truncateExcerpts(pages: EvidencePage[], maxChars: number): EvidencePage[] {
  let remaining = maxChars;
  return pages.map((page) => {
    const excerpt = page.excerpt.slice(0, Math.max(0, remaining));
    remaining -= excerpt.length;
    return { ...page, excerpt };
  });
}

@Injectable()
export class SiteResearchService extends AnalysisResearch {
  async collect(snapshot: AnalysisInputSnapshot): Promise<PromptResearch> {
    const pages: EvidencePage[] = [];
    const failures: EvidenceFailure[] = [];
    let budget = ANALYSIS_LIMITS.maxTotalPages;

    if (snapshot.websiteUrl) {
      const site = await readSite(snapshot.websiteUrl, 'website', ANALYSIS_LIMITS.maxProjectPages, budget);
      pages.push(...site.pages);
      failures.push(...site.failures);
      budget -= site.pages.length;
    }
    for (const url of snapshot.competitorUrls) {
      if (budget <= 0) break;
      const site = await readSite(url, 'competitor', ANALYSIS_LIMITS.maxCompetitorPages, budget);
      pages.push(...site.pages);
      failures.push(...site.failures);
      budget -= site.pages.length;
    }

    const websiteReadable = pages.some((page) => page.source === 'website');
    return { pages: truncateExcerpts(pages, ANALYSIS_LIMITS.maxInputChars), failures, websiteReadable };
  }
}
