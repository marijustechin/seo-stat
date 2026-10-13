import { Injectable } from '@nestjs/common';
import { safeFetch } from '../analysis/research/safe-fetch.js';
import { CONTENT_LIMITS } from './content.limits.js';
import type { DroppedLinkEntry, LinkPlan, LinkPlanEntry } from './content.types.js';

/**
 * Where the project's own page URLs come from. A sitemap is the preferred
 * source because it lists pages the article may want to link to without crawling
 * anything; the pages the research already fetched are the fallback.
 */
export abstract class ContentLinkSource {
  /** Absolute URLs from the project's sitemap, or an empty list. Never throws. */
  abstract sitemapUrls(siteUrl: string | null): Promise<string[]>;
}

const SITEMAP_ROOTS = ['/sitemap.xml', '/sitemap_index.xml'];
/** A sitemap index is followed for at most this many child sitemaps. */
const MAX_CHILD_SITEMAPS = 2;

function locs(xml: string): string[] {
  const found: string[] = [];
  const pattern = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const value = match[1];
    if (value) found.push(value);
  }
  return found;
}

async function fetchXml(url: string): Promise<string | null> {
  try {
    const result = await safeFetch(url);
    return result.html;
  } catch {
    return null;
  }
}

/**
 * Reads the project's sitemap with the shared SSRF-protected fetch. Bounded: at
 * most two root candidates and two child sitemaps, and any failure simply yields
 * no URLs, because link planning must never break a generation run.
 */
@Injectable()
export class SitemapLinkSource extends ContentLinkSource {
  async sitemapUrls(siteUrl: string | null): Promise<string[]> {
    if (!siteUrl) return [];
    let origin: URL;
    try {
      origin = new URL(siteUrl);
    } catch {
      return [];
    }

    for (const root of SITEMAP_ROOTS) {
      const xml = await fetchXml(new URL(root, origin).toString());
      if (!xml) continue;
      const found = locs(xml);
      if (found.length === 0) continue;
      if (!/<sitemapindex/i.test(xml)) return found;

      const pages: string[] = [];
      for (const child of found.slice(0, MAX_CHILD_SITEMAPS)) {
        const childXml = await fetchXml(child);
        if (childXml) pages.push(...locs(childXml));
        if (pages.length >= CONTENT_LIMITS.sitemapMaxUrls) break;
      }
      if (pages.length > 0) return pages;
    }
    return [];
  }
}

/** Paths that are never useful internal link targets. */
const EXCLUDED_PATH = /(\/wp-json\/|\/wp-content\/|\/wp-admin\/|\/feed\/?$|\/tag\/|\/author\/|\/search\/|\/page\/\d+)/i;
const DATE_LIKE_PATH = /\/\d{4}\/\d{2}\//;

export interface LinkCandidates {
  /** The project's origin, or null when no usable website URL is configured. */
  origin: string | null;
  /** Allowed internal paths, shallowest first. */
  paths: string[];
  source: 'sitemap' | 'research' | 'none';
  /** How many usable paths were found, before the prompt cap. */
  total: number;
  truncated: number;
}

export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** Comparable form of an absolute URL: no fragment, no trailing slash. */
function normalizeUrlKey(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return null;
  }
}

function originOf(siteUrl: string | null): string | null {
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).origin;
  } catch {
    return null;
  }
}

/** Resolves a link target; a relative target needs a known project origin. */
function resolveTarget(rawUrl: string, origin: string | null): URL | null {
  try {
    if (/^https?:\/\//i.test(rawUrl)) return new URL(rawUrl);
    if (!origin) return null;
    return new URL(rawUrl, origin);
  } catch {
    return null;
  }
}

/**
 * Reduces candidate URLs to the paths an article may link to. Everything that is
 * not the project's own page is discarded here, so the writer is only ever given
 * targets that actually exist.
 */
export function buildLinkCandidates(
  siteUrl: string | null,
  sitemapUrls: string[],
  researchUrls: string[],
): LinkCandidates {
  const origin = originOf(siteUrl);
  if (!origin) return { origin: null, paths: [], source: 'none', total: 0, truncated: 0 };

  const fromSitemap = Array.isArray(sitemapUrls) && sitemapUrls.length > 0;
  const input = fromSitemap ? sitemapUrls : Array.isArray(researchUrls) ? researchUrls : [];
  const source: LinkCandidates['source'] = fromSitemap ? 'sitemap' : input.length > 0 ? 'research' : 'none';

  const seen = new Set<string>();
  const paths: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    let url: URL;
    try {
      url = new URL(raw, origin);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;
    const path = normalizePath(url.pathname);
    if (path === '/' || path.length === 0) continue;
    if (EXCLUDED_PATH.test(path) || DATE_LIKE_PATH.test(path)) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
    if (paths.length >= CONTENT_LIMITS.sitemapMaxUrls) break;
  }

  // Shallower paths are the ones an article usually wants to link to.
  paths.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  const kept = paths.slice(0, CONTENT_LIMITS.linkCandidates);
  return {
    origin,
    paths: kept,
    source,
    total: paths.length,
    truncated: Math.max(0, paths.length - kept.length),
  };
}

const MARKDOWN_LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export interface LinkPolicyInput {
  origin: string | null;
  allowedPaths: string[];
  /** URLs actually retrieved during this run; only these may be external links. */
  allowedExternal: string[];
  source: LinkPlan['source'];
  candidates: number;
  truncated: number;
}

export interface AppliedLinkPolicy {
  bodyMarkdown: string;
  plan: LinkPlan;
}

/**
 * Keeps only links that can be justified: internal links must be in the project's
 * URL list, and external links must have been retrieved during the run. Anything
 * else keeps its anchor text and loses the URL, so an invented address never
 * reaches a published article.
 *
 * Non-http links (`mailto:`, `tel:`, fragments) and images are left untouched.
 */
export function applyLinkPolicy(body: string, input: LinkPolicyInput): AppliedLinkPolicy {
  const allowedInternal = new Set(input.allowedPaths.map(normalizePath));
  const allowedExternal = new Set<string>();
  for (const candidate of input.allowedExternal) {
    allowedExternal.add(candidate);
    const key = normalizeUrlKey(candidate);
    if (key) allowedExternal.add(key);
  }
  const internal: LinkPlanEntry[] = [];
  const external: LinkPlanEntry[] = [];
  const dropped: DroppedLinkEntry[] = [];

  const bodyMarkdown = body.replace(MARKDOWN_LINK, (whole, bang: string, text: string, rawUrl: string) => {
    if (bang === '!') return whole;
    if (!/^https?:\/\//i.test(rawUrl) && !rawUrl.startsWith('/')) return whole;

    const resolved = resolveTarget(rawUrl, input.origin);
    if (!resolved || (resolved.protocol !== 'http:' && resolved.protocol !== 'https:')) {
      dropped.push({
        url: rawUrl,
        text,
        kind: 'internal',
        reason: 'The address could not be resolved, so the link was removed.',
      });
      return text;
    }

    const isInternal = input.origin !== null && resolved.origin === input.origin;
    if (isInternal) {
      if (allowedInternal.has(normalizePath(resolved.pathname))) {
        if (internal.length >= CONTENT_LIMITS.linkMaxInternal) {
          dropped.push({ url: rawUrl, text, kind: 'internal', reason: 'Over the internal link cap for one article.' });
          return text;
        }
        internal.push({ url: rawUrl, text, kind: 'internal' });
        return whole;
      }
      dropped.push({
        url: rawUrl,
        text,
        kind: 'internal',
        reason: 'Not in the project URL list, so the link was removed instead of shipping an invented or broken address.',
      });
      return text;
    }

    const externalKey = normalizeUrlKey(resolved.toString()) ?? resolved.toString();
    if (allowedExternal.has(externalKey) || allowedExternal.has(rawUrl)) {
      if (external.length >= CONTENT_LIMITS.linkMaxExternal) {
        dropped.push({ url: rawUrl, text, kind: 'external', reason: 'Over the external link cap for one article.' });
        return text;
      }
      external.push({ url: rawUrl, text, kind: 'external' });
      return whole;
    }
    dropped.push({
      url: rawUrl,
      text,
      kind: 'external',
      reason: 'Not retrieved during this run, so the link was removed rather than shipped as an unverified source.',
    });
    return text;
  });

  return {
    bodyMarkdown,
    plan: {
      source: input.source,
      candidates: input.candidates,
      truncated: input.truncated,
      internal,
      external,
      dropped,
    },
  };
}
