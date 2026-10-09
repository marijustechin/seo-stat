import { Injectable } from '@nestjs/common';
import { safeJsonRequest, type JsonRequestOptions, type JsonResponse } from '../../common/net/safe-json-request.js';
import { SafeFetchError } from '../../common/net/public-url.js';
import { detectImageMime } from './image-meta.js';
import {
  ImageProvider,
  ImageProviderError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
} from './image.provider.js';

/**
 * Cloudflare Workers AI image provider (verified 2026-10-09):
 * `POST https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`
 * with Bearer-token auth and `{ prompt, steps }`; the JSON envelope holds
 * `result.image` as base64 (JPEG by default). `steps` max 8 (default 4); prompt
 * max 2048 characters.
 *
 * This is a separate capability from the DeepSeek text provider and only runs
 * when explicitly selected with `IMAGE_PROVIDER=cloudflare`. On the Workers Free
 * plan the free daily neuron allocation applies; quota exhaustion and temporary
 * capacity are distinguished by Cloudflare error codes.
 */
export const CLOUDFLARE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
export const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
export const CLOUDFLARE_MAX_PROMPT_LENGTH = 2048;
export const CLOUDFLARE_DEFAULT_STEPS = 4;
export const CLOUDFLARE_MAX_STEPS = 8;

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 16_000_000;

export type ImageHttpRequest = (options: JsonRequestOptions) => Promise<JsonResponse>;

function sanitize(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export function clampSteps(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return CLOUDFLARE_DEFAULT_STEPS;
  return Math.min(CLOUDFLARE_MAX_STEPS, Math.max(1, Math.trunc(parsed)));
}

interface CloudflareEnvelope {
  result?: { image?: unknown } | null;
  success?: unknown;
  errors?: Array<{ code?: unknown; message?: unknown }> | null;
}

/** Map a Cloudflare response/error code to a classified provider error. */
export function classifyCloudflareError(
  code: number | null,
  httpStatus: number,
  message: string,
): ImageProviderError {
  if (code === 3036) {
    return new ImageProviderError(
      'quota',
      'The Cloudflare Workers AI free daily allocation is exhausted. It resets daily on the Workers Free plan; this was not retried and no paid plan was used.',
    );
  }
  if (code === 3040) {
    return new ImageProviderError(
      'capacity',
      'Cloudflare Workers AI is temporarily at capacity. Try again shortly.',
    );
  }
  if (code === 5035) {
    return new ImageProviderError(
      'plan',
      'This Cloudflare model requires a Workers Paid plan; the free plan cannot use it. No paid upgrade was attempted.',
    );
  }
  if (code === 3007 || code === 3008) {
    return new ImageProviderError('timeout', 'Cloudflare Workers AI timed out. Try again.');
  }
  if (code === 3003 || code === 5004 || code === 5007 || code === 3042 || code === 3006) {
    const detail = sanitize(message);
    return new ImageProviderError(
      'invalid',
      detail ? `Cloudflare rejected the request: ${detail}` : `Cloudflare rejected the request (HTTP ${httpStatus}).`,
    );
  }
  return new ImageProviderError('other', `Cloudflare image generation failed (HTTP ${httpStatus}).`);
}

@Injectable()
export class CloudflareImageProvider extends ImageProvider {
  readonly providerId = 'cloudflare';
  readonly model = CLOUDFLARE_MODEL;
  readonly maxPromptLength = CLOUDFLARE_MAX_PROMPT_LENGTH;
  override readonly defaultParameters: Record<string, unknown>;
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly steps: number;
  private readonly http: ImageHttpRequest;

  constructor(
    accountId: string = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? '',
    apiToken: string = process.env.CLOUDFLARE_API_TOKEN?.trim() ?? '',
    steps: number = clampSteps(process.env.IMAGE_STEPS),
    http: ImageHttpRequest = safeJsonRequest,
  ) {
    super();
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.steps = steps;
    this.http = http;
    this.defaultParameters = { steps };
  }

  isConfigured(): boolean {
    return this.accountId.length > 0 && this.apiToken.length > 0;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      throw new ImageProviderError('auth', 'Cloudflare Workers AI is not configured on the server.');
    }
    const prompt = request.prompt;
    if (prompt.trim().length === 0) {
      throw new ImageProviderError('invalid', 'The prompt must not be empty.');
    }
    if (prompt.length > CLOUDFLARE_MAX_PROMPT_LENGTH) {
      throw new ImageProviderError(
        'invalid',
        `The prompt is ${prompt.length} characters; Cloudflare FLUX accepts at most ${CLOUDFLARE_MAX_PROMPT_LENGTH}.`,
      );
    }
    const steps = clampSteps(request.steps ?? this.steps);
    const url = `${CLOUDFLARE_API_BASE}/accounts/${encodeURIComponent(this.accountId)}/ai/run/${this.model}`;

    let response: JsonResponse;
    try {
      response = await this.http({
        url,
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ prompt, steps }),
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxBytes: MAX_RESPONSE_BYTES,
        retries: 0,
      });
    } catch (error) {
      if (error instanceof SafeFetchError && (error.kind === 'timeout' || error.kind === 'network-error')) {
        throw new ImageProviderError('timeout', 'Cloudflare Workers AI did not respond in time. Try again.');
      }
      throw error;
    }

    const envelope = (response.json ?? null) as CloudflareEnvelope | null;
    const firstError = Array.isArray(envelope?.errors) ? envelope?.errors?.[0] : undefined;
    const code = typeof firstError?.code === 'number' ? firstError.code : null;
    if (!response.ok || envelope?.success === false) {
      const providerMessage = typeof firstError?.message === 'string' ? firstError.message : '';
      throw classifyCloudflareError(code, response.status, providerMessage);
    }
    const image = envelope?.result?.image;
    if (typeof image !== 'string' || image.length === 0) {
      throw new ImageProviderError('invalid', 'Cloudflare returned no image.');
    }

    const buffer = Buffer.from(image, 'base64');
    const mimeType = detectImageMime(buffer);
    if (!mimeType) {
      throw new ImageProviderError('invalid', 'Cloudflare returned an image in an unsupported format.');
    }
    return { base64: image, mimeType, usage: null, parameters: { steps, model: this.model } };
  }
}
