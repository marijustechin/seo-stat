import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { ANALYSIS_LIMITS } from '../analysis.limits.js';
import { SafeFetchError, safeLookup, validateUrlShape } from '../../../common/net/public-url.js';

// URL/address protections live in the shared net module; re-exported here so the
// analysis research code (and its tests) keep a single import location.
export {
  SafeFetchError,
  isBlockedAddress,
  safeLookup,
  validateUrlShape,
  type FetchFailureKind,
} from '../../../common/net/public-url.js';

export interface SafeFetchResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  title: string;
  text: string;
  html: string;
  bytes: number;
  fetchedAt: string;
}

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const captured = match?.[1];
  return captured ? decodeEntities(captured).replace(/\s+/g, ' ').trim().slice(0, 300) : '';
}

export function extractText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const text = decodeEntities(withoutScripts.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, ANALYSIS_LIMITS.maxCharsPerPage);
}

function requestOnce(url: URL, redirectsLeft: number): Promise<SafeFetchResult> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = lib(
      url,
      {
        method: 'GET',
        headers: {
          'user-agent': 'seo-stat-analysis/1.0 (+local tooling)',
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
        },
        lookup: safeLookup as never,
        timeout: ANALYSIS_LIMITS.requestTimeoutMs,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (REDIRECT_STATUS.has(status) && location) {
          response.resume();
          if (redirectsLeft <= 0) {
            reject(new SafeFetchError('too-many-redirects', 'Too many redirects.'));
            return;
          }
          let next: URL;
          try {
            next = validateUrlShape(new URL(location, url).toString());
          } catch (error) {
            reject(error);
            return;
          }
          resolve(requestOnce(next, redirectsLeft - 1));
          return;
        }
        if (status >= 400 || status < 200) {
          response.resume();
          reject(new SafeFetchError('http-error', `HTTP ${status}`));
          return;
        }
        const contentType = String(response.headers['content-type'] ?? '');
        if (contentType && !/text\/html|text\/plain|xhtml/i.test(contentType)) {
          response.resume();
          reject(new SafeFetchError('unsupported-content', `Unsupported content type: ${contentType}`));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > ANALYSIS_LIMITS.maxResponseBytes) {
            response.destroy();
            reject(new SafeFetchError('too-large', 'Response exceeded the size limit.'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          const html = Buffer.concat(chunks).toString('utf8');
          resolve({
            requestedUrl: url.toString(),
            finalUrl: url.toString(),
            status,
            contentType,
            title: extractTitle(html),
            text: extractText(html),
            html,
            bytes,
            fetchedAt: new Date().toISOString(),
          });
        });
        response.on('error', (error) => {
          reject(error instanceof SafeFetchError ? error : new SafeFetchError('network-error', error.message));
        });
      },
    );
    request.on('timeout', () => {
      request.destroy(new SafeFetchError('timeout', 'Request timed out.'));
    });
    request.on('error', (error) => {
      reject(error instanceof SafeFetchError ? error : new SafeFetchError('network-error', error.message));
    });
    request.end();
  });
}

/** Fetch a public page with SSRF protection and one retry on transient errors. */
export async function safeFetch(rawUrl: string, redirectsLeft = ANALYSIS_LIMITS.maxRedirects): Promise<SafeFetchResult> {
  const url = validateUrlShape(rawUrl);
  let lastError: unknown;
  for (let attempt = 0; attempt <= ANALYSIS_LIMITS.maxRetries; attempt += 1) {
    try {
      return await requestOnce(url, redirectsLeft);
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof SafeFetchError && (error.kind === 'timeout' || error.kind === 'network-error');
      if (!retryable) break;
    }
  }
  throw lastError instanceof SafeFetchError
    ? lastError
    : new SafeFetchError('network-error', lastError instanceof Error ? lastError.message : 'Fetch failed');
}
