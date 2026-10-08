import { BadRequestException } from '@nestjs/common';

export const MAX_COMPETITOR_URLS = 5;

/**
 * Normalize a competitor URL list: trim, drop blanks, remove trailing slashes,
 * and de-duplicate. Returns undefined when the field was not provided.
 */
export function normalizeCompetitorUrls(urls: string[] | undefined): string[] | undefined {
  if (urls === undefined) return undefined;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of urls) {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  if (result.length > MAX_COMPETITOR_URLS) {
    throw new BadRequestException(`At most ${MAX_COMPETITOR_URLS} competitor URLs are allowed.`);
  }
  return result;
}
