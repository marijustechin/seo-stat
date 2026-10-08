export const ANALYSIS_SCOPE_TEXT =
  'The analysis reads a bounded selection of public pages: your website (home, about, services, contact, and audience pages) and, if provided, each competitor site. It only reads a few relevant pages per site, never a full-domain crawl.';

export function describeLimits(limits?: Record<string, number>): string {
  if (!limits) {
    return 'A few relevant pages per site are read, within fixed time and size limits.';
  }
  const project = limits.maxProjectPages ?? 6;
  const competitor = limits.maxCompetitorPages ?? 3;
  const total = limits.maxTotalPages ?? 15;
  const competitors = limits.maxCompetitors ?? 5;
  return `Up to ${project} pages from your website and ${competitor} per competitor (max ${competitors} competitors, ${total} pages total).`;
}
