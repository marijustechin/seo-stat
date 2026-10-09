import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { Injectable } from '@nestjs/common';
import { safeJsonRequest, type JsonResponse } from '../../../common/net/safe-json-request.js';
import {
  type WordpressCredentials,
  WordpressClient,
  type WordpressDraftInput,
  type WordpressIdentity,
  type WordpressMedia,
  type WordpressMediaInput,
  type WordpressPost,
  WordpressRequestError,
} from './wordpress-client.js';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 1_000_000;

function sanitizeMessage(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

interface RawPost {
  id?: number;
  status?: string;
  link?: string;
  slug?: string;
  modified?: string;
  content?: { rendered?: string; raw?: string };
}

interface RawIdentity {
  id?: number;
  name?: string;
  slug?: string;
  capabilities?: Record<string, boolean>;
  roles?: string[];
}

@Injectable()
export class HttpWordpressClient extends WordpressClient {
  readonly clientId = 'wordpress-rest';

  private endpoint(siteUrl: string, path: string): string {
    const base = siteUrl.replace(/\/+$/, '');
    return `${base}/wp-json/wp/v2${path}`;
  }

  private authHeader(credentials: WordpressCredentials): string {
    const token = Buffer.from(`${credentials.username}:${credentials.applicationPassword}`, 'utf8').toString('base64');
    return `Basic ${token}`;
  }

  private toError(response: JsonResponse): WordpressRequestError {
    const body = response.json as { code?: unknown; message?: unknown } | null;
    const code = typeof body?.code === 'string' ? body.code : null;
    const message = sanitizeMessage(body?.message) || `WordPress returned HTTP ${response.status}.`;
    return new WordpressRequestError(response.status, code, message);
  }

  private async requestJson(
    credentials: WordpressCredentials,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const response = await safeJsonRequest({
      url: this.endpoint(credentials.siteUrl, path),
      method,
      headers: {
        authorization: this.authHeader(credentials),
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxBytes: MAX_RESPONSE_BYTES,
      retries: method === 'GET' ? 1 : 0,
    });
    if (!response.ok) throw this.toError(response);
    return response.json;
  }

  private toPost(raw: unknown): WordpressPost {
    const post = (raw ?? {}) as RawPost;
    return {
      id: Number(post.id ?? 0),
      status: String(post.status ?? ''),
      link: String(post.link ?? ''),
      slug: String(post.slug ?? ''),
      modified: String(post.modified ?? ''),
      contentRendered: String(post.content?.raw ?? post.content?.rendered ?? ''),
    };
  }

  async verify(credentials: WordpressCredentials): Promise<WordpressIdentity> {
    const raw = (await this.requestJson(credentials, 'GET', '/users/me?context=edit')) as RawIdentity;
    return {
      id: Number(raw.id ?? 0),
      name: String(raw.name ?? ''),
      slug: raw.slug ? String(raw.slug) : null,
      capabilities: raw.capabilities && typeof raw.capabilities === 'object' ? raw.capabilities : {},
      roles: Array.isArray(raw.roles) ? raw.roles.map((role) => String(role)) : [],
    };
  }

  async getPost(credentials: WordpressCredentials, postId: number): Promise<WordpressPost> {
    return this.toPost(await this.requestJson(credentials, 'GET', `/posts/${postId}?context=edit`));
  }

  async findPostBySlug(credentials: WordpressCredentials, slug: string): Promise<WordpressPost | null> {
    const raw = await this.requestJson(
      credentials,
      'GET',
      `/posts?slug=${encodeURIComponent(slug)}&status=draft&context=edit&per_page=1`,
    );
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return this.toPost(raw[0]);
  }

  private draftPayload(input: WordpressDraftInput, includeStatus: boolean): Record<string, unknown> {
    const payload: Record<string, unknown> = { title: input.title, content: input.content };
    if (input.slug) payload.slug = input.slug;
    if (input.excerpt !== undefined) payload.excerpt = input.excerpt;
    if (input.featuredMedia !== undefined) payload.featured_media = input.featuredMedia;
    if (includeStatus) payload.status = 'draft';
    return payload;
  }

  async createDraft(credentials: WordpressCredentials, input: WordpressDraftInput): Promise<WordpressPost> {
    return this.toPost(await this.requestJson(credentials, 'POST', '/posts', this.draftPayload(input, true)));
  }

  async updateDraft(
    credentials: WordpressCredentials,
    postId: number,
    input: WordpressDraftInput,
  ): Promise<WordpressPost> {
    // status is intentionally omitted on update: never publish, schedule, or
    // convert an existing post between statuses.
    return this.toPost(await this.requestJson(credentials, 'POST', `/posts/${postId}`, this.draftPayload(input, false)));
  }

  async uploadMedia(credentials: WordpressCredentials, input: WordpressMediaInput): Promise<WordpressMedia> {
    const boundary = `---------------------------seo-stat-${randomUUID().replace(/-/g, '')}`;
    const safeName = basename(input.fileName).replace(/["\r\n]/g, '') || 'cover';
    const parts: Buffer[] = [];
    parts.push(Buffer.from(`--${boundary}\r\n`, 'utf8'));
    parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${safeName}"\r\n`, 'utf8'));
    parts.push(Buffer.from(`Content-Type: ${input.mimeType}\r\n\r\n`, 'utf8'));
    parts.push(input.data);
    parts.push(Buffer.from('\r\n', 'utf8'));
    if (input.altText) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="alt_text"\r\n\r\n${input.altText.slice(0, 500)}\r\n`,
          'utf8',
        ),
      );
    }
    parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
    const body = Buffer.concat(parts);

    const response = await safeJsonRequest({
      url: this.endpoint(credentials.siteUrl, '/media'),
      method: 'POST',
      headers: {
        authorization: this.authHeader(credentials),
        accept: 'application/json',
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(body.length),
      },
      body,
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxBytes: MAX_RESPONSE_BYTES,
    });
    if (!response.ok) throw this.toError(response);
    const media = (response.json ?? {}) as { id?: number; source_url?: string };
    return { id: Number(media.id ?? 0), sourceUrl: String(media.source_url ?? '') };
  }
}
