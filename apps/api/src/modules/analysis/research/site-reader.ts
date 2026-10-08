import { SafeFetchError, safeFetch, validateUrlShape } from './safe-fetch.js';

export type SiteKind = 'website' | 'competitor';

export interface EvidencePage {
  source: SiteKind;
  url: string;
  title: string;
  fetchedAt: string;
  excerpt: string;
}

export interface EvidenceFailure {
  source: SiteKind;
  url: string;
  reason: string;
}

export interface SiteResearch {
  source: SiteKind;
  baseUrl: string;
  pages: EvidencePage[];
  failures: EvidenceFailure[];
}

const KEYWORDS = [
  'about',
  'service',
  'solution',
  'what-we-do',
  'contact',
  'team',
  'compan',
  'industr',
  'brand',
  'retail',
  'resident',
  'council',
  'school',
  'institution',
  'collection',
  'sustainab',
  'textile',
  'clothing',
  'recycl',
  'offer',
  'partner',
  'fleet',
];

const EXCLUDE = ['login', 'signin', 'sign-in', 'cart', 'checkout', 'privacy', 'cookie', 'terms', 'job', 'wp-login'];

function extractLinks(html: string, baseUrl: URL): string[] {
  const links = new Set<string>();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const href = match[1];
    if (!href) continue;
    try {
      const url = new URL(href, baseUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      if (url.hostname !== baseUrl.hostname) continue;
      url.hash = '';
      links.add(url.toString());
    } catch {
      // ignore malformed links
    }
  }
  return [...links];
}

export function scoreLink(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;
  for (const keyword of KEYWORDS) if (lower.includes(keyword)) score += 1;
  for (const exclude of EXCLUDE) if (lower.includes(exclude)) score -= 3;
  return score;
}

/** Read a bounded selection of relevant public pages from one site. */
export async function readSite(rawBaseUrl: string, source: SiteKind, maxPages: number, budget: number): Promise<SiteResearch> {
  const failures: EvidenceFailure[] = [];
  let base: URL;
  try {
    base = validateUrlShape(rawBaseUrl);
  } catch (error) {
    const reason = error instanceof SafeFetchError ? error.message : 'Invalid URL.';
    return { source, baseUrl: rawBaseUrl, pages: [], failures: [{ source, url: rawBaseUrl, reason }] };
  }

  const pages: EvidencePage[] = [];
  let home;
  try {
    home = await safeFetch(base.toString());
  } catch (error) {
    const reason = error instanceof SafeFetchError ? error.message : 'Fetch failed.';
    return { source, baseUrl: base.toString(), pages: [], failures: [{ source, url: base.toString(), reason }] };
  }

  pages.push({
    source,
    url: home.finalUrl,
    title: home.title || home.finalUrl,
    fetchedAt: home.fetchedAt,
    excerpt: home.text,
  });

  const limit = Math.min(maxPages, budget);
  if (limit <= 1) return { source, baseUrl: base.toString(), pages, failures };

  const candidates = extractLinks(home.html, base)
    .filter((link) => link !== home.finalUrl && !pages.some((page) => page.url === link))
    .map((link) => ({ link, score: scoreLink(link) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.link);

  for (const link of candidates) {
    if (pages.length >= limit) break;
    try {
      const page = await safeFetch(link);
      pages.push({
        source,
        url: page.finalUrl,
        title: page.title || page.finalUrl,
        fetchedAt: page.fetchedAt,
        excerpt: page.text,
      });
    } catch (error) {
      failures.push({
        source,
        url: link,
        reason: error instanceof SafeFetchError ? error.message : 'Fetch failed.',
      });
    }
  }

  return { source, baseUrl: base.toString(), pages, failures };
}
