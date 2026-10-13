import type { PromptResearch } from '../analysis/ai/analysis.prompt.js';
import type { EvidencePage } from '../analysis/research/site-reader.js';
import { CONTENT_LIMITS } from './content.limits.js';
import type { GapBudget } from './content.types.js';

export interface BudgetedResearch {
  /** Research reduced to what one article run is allowed to consume. */
  research: PromptResearch;
  budget: GapBudget;
}

/**
 * Applies the documented per-run research budget to an article run.
 *
 * The run performs exactly one bounded research call, so this is the only place
 * a total budget can be enforced without changing the shared analysis port. Pages
 * beyond the budget are dropped rather than queued for another lookup; an
 * exhausted budget leads to rewriting or omission, never to a question. The
 * dropped count is recorded so exhaustion is observable instead of silent.
 */
export function applyResearchBudget(research: PromptResearch): BudgetedResearch {
  const maxPages = CONTENT_LIMITS.researchMaxPages;
  const maxInputChars = CONTENT_LIMITS.researchMaxInputChars;
  const available = Array.isArray(research.pages) ? research.pages : [];

  const selected: EvidencePage[] = [];
  let remaining = maxInputChars;
  for (const page of available) {
    if (selected.length >= maxPages) break;
    if (remaining <= 0) break;
    const excerpt = (page.excerpt ?? '').slice(0, remaining);
    remaining -= excerpt.length;
    selected.push({ ...page, excerpt });
  }

  return {
    research: { ...research, pages: selected },
    budget: {
      maxPages,
      usedPages: selected.length,
      droppedPages: Math.max(0, available.length - selected.length),
      maxInputChars,
      usedInputChars: selected.reduce((total, page) => total + page.excerpt.length, 0),
    },
  };
}
