import { apiUrl } from '@/shared/config/app';

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface NestErrorBody {
  message?: string | string[];
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as NestErrorBody).message;
    if (Array.isArray(message) && message.length > 0) return message.join('; ');
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return `Request failed (${status})`;
}

/**
 * Fetch JSON from the API under the same origin.
 *
 * Content-Type is only set when a body is present: Fastify rejects an empty
 * body that declares `application/json` ("Body cannot be empty when
 * content-type is set to 'application/json'"), so bodyless actions such as
 * starting an analysis or archiving a project must omit it.
 *
 * `baseUrl` is for tests only; the application always uses the same origin.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  baseUrl?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const target = baseUrl ? `${baseUrl.replace(/\/+$/, '')}${apiUrl(path)}` : apiUrl(path);
  const response = await fetch(target, { ...init, headers, cache: 'no-store' });

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new ApiError(response.status, messageFrom(body, response.status), body);
  }
  return body as T;
}
