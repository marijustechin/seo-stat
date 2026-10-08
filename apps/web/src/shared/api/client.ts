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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = { 'content-type': 'application/json', ...(init.headers ?? {}) };
  const response = await fetch(apiUrl(path), { ...init, headers, cache: 'no-store' });

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
