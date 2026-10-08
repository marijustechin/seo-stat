import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { ANALYSIS_LIMITS } from '../analysis.limits.js';

export type FetchFailureKind =
  | 'invalid-url'
  | 'blocked-host'
  | 'blocked-address'
  | 'too-many-redirects'
  | 'too-large'
  | 'timeout'
  | 'http-error'
  | 'unsupported-content'
  | 'network-error';

export class SafeFetchError extends Error {
  constructor(
    readonly kind: FetchFailureKind,
    message: string,
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

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

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set(['', '80', '443']);
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((value) => Number(value));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return true;
  }
  const [a = 0, b = 0] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice('::ffff:'.length);
    return isIP(mapped) === 4 ? isBlockedIpv4(mapped) : true;
  }
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  return true;
}

export function validateUrlShape(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('invalid-url', 'Not a valid absolute URL.');
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SafeFetchError('invalid-url', 'Only http and https are allowed.');
  }
  if (url.username || url.password) {
    throw new SafeFetchError('invalid-url', 'URLs with credentials are not allowed.');
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new SafeFetchError('invalid-url', 'Only ports 80 and 443 are allowed.');
  }
  const hostname = url.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new SafeFetchError('blocked-host', `Blocked host: ${hostname}`);
  }
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;

/**
 * A DNS lookup that rejects private, loopback, link-local, and reserved
 * addresses at connect time. This runs for every redirect hop because each
 * request performs its own lookup.
 */
export function safeLookup(hostname: string, options: unknown, callback: LookupCallback): void {
  dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) {
      callback(error);
      return;
    }
    if (!addresses || addresses.length === 0) {
      callback(new SafeFetchError('network-error', `No addresses for ${hostname}`));
      return;
    }
    for (const entry of addresses) {
      if (isBlockedAddress(entry.address)) {
        callback(new SafeFetchError('blocked-address', `Blocked address for ${hostname}`));
        return;
      }
    }
    const wantsAll = typeof options === 'object' && options !== null && 'all' in options && Boolean(options.all);
    if (wantsAll) {
      callback(null, addresses);
    } else {
      const first = addresses[0];
      if (!first) {
        callback(new SafeFetchError('network-error', `No addresses for ${hostname}`));
        return;
      }
      callback(null, first.address, first.family);
    }
  });
}

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
