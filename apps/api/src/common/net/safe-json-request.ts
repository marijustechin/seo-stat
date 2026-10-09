import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { SafeFetchError, sameOrigin, safeLookup, validateUrlShape } from './public-url.js';

/**
 * A bounded HTTP request helper for JSON APIs (external integrations). It reuses
 * the shared SSRF protections and, critically, never forwards authentication
 * headers to a different origin after a redirect: on a cross-origin redirect the
 * sensitive headers are dropped before the next hop.
 *
 * Non-2xx responses are returned (not thrown) so callers can map provider error
 * payloads. Only transport failures (timeout, DNS, network) throw
 * `SafeFetchError`.
 */

const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization']);

/**
 * Headers to send on the next redirect hop. On a cross-origin redirect the
 * sensitive headers are dropped so authentication is never forwarded to a
 * different origin.
 */
export function headersForRedirect(
  headers: Record<string, string>,
  crossOrigin: boolean,
): Record<string, string> {
  if (!crossOrigin) return headers;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!SENSITIVE_HEADERS.has(key.toLowerCase())) next[key] = value;
  }
  return next;
}

export interface JsonRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Retries only apply to idempotent GET requests; creates are never auto-retried. */
  retries?: number;
}

export interface JsonResponse {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  json: unknown;
  text: string;
  finalUrl: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 512_000;
const DEFAULT_MAX_REDIRECTS = 3;
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

function requestOnce(
  originalOrigin: URL,
  url: URL,
  method: string,
  headers: Record<string, string>,
  body: string | Buffer | undefined,
  timeoutMs: number,
  maxBytes: number,
  maxRedirects: number,
): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = lib(
      url,
      { method, headers, lookup: safeLookup as never, timeout: timeoutMs },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (REDIRECT_STATUS.has(status) && location) {
          response.resume();
          if (maxRedirects <= 0) {
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
          const nextHeaders = headersForRedirect(headers, !sameOrigin(originalOrigin, next));
          resolve(
            requestOnce(originalOrigin, next, method, nextHeaders, body, timeoutMs, maxBytes, maxRedirects - 1),
          );
          return;
        }

        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            response.destroy();
            reject(new SafeFetchError('too-large', 'Response exceeded the size limit.'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: unknown;
          try {
            json = text.length > 0 ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({
            status,
            ok: status >= 200 && status < 300,
            headers: Object.fromEntries(
              Object.entries(response.headers).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.join(', ') : String(value ?? ''),
              ]),
            ),
            json,
            text,
            finalUrl: url.toString(),
          });
        });
        response.on('error', (error) => {
          reject(error instanceof SafeFetchError ? error : new SafeFetchError('network-error', error.message));
        });
      },
    );
    request.on('timeout', () => request.destroy(new SafeFetchError('timeout', 'Request timed out.')));
    request.on('error', (error) =>
      reject(error instanceof SafeFetchError ? error : new SafeFetchError('network-error', error.message)),
    );
    if (body !== undefined) request.write(body);
    request.end();
  });
}

function isRetryable(error: unknown): boolean {
  return error instanceof SafeFetchError && (error.kind === 'timeout' || error.kind === 'network-error');
}

export async function safeJsonRequest(options: JsonRequestOptions): Promise<JsonResponse> {
  const url = validateUrlShape(options.url);
  const originalOrigin = url;
  const method = options.method ?? 'GET';
  const headers = { ...(options.headers ?? {}) };
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const retries = method === 'GET' ? (options.retries ?? 0) : 0;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestOnce(
        originalOrigin,
        url,
        method,
        headers,
        options.body,
        timeoutMs,
        maxBytes,
        maxRedirects,
      );
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) break;
    }
  }
  throw lastError instanceof SafeFetchError
    ? lastError
    : new SafeFetchError('network-error', lastError instanceof Error ? lastError.message : 'Request failed');
}
