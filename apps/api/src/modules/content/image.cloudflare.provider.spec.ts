import { describe, expect, it } from 'vitest';
import { SafeFetchError } from '../../common/net/public-url.js';
import type { JsonRequestOptions, JsonResponse } from '../../common/net/safe-json-request.js';
import {
  CLOUDFLARE_MAX_PROMPT_LENGTH,
  CloudflareImageProvider,
  clampSteps,
  classifyCloudflareError,
  type ImageHttpRequest,
} from './image.cloudflare.provider.js';
import { ImageProviderError } from './image.provider.js';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]).toString('base64');

function jsonResponse(json: unknown, status = 200): JsonResponse {
  return { status, ok: status >= 200 && status < 300, headers: {}, json, text: '', finalUrl: 'https://api.cloudflare.com/' };
}

function envelope(base64: string) {
  return { result: { image: base64 }, success: true, errors: [], messages: [] };
}

function provider(handler: ImageHttpRequest, steps = 4) {
  return new CloudflareImageProvider('acct-123', 'secret-token', steps, handler);
}

describe('CloudflareImageProvider', () => {
  it('POSTs the documented prompt/steps body to the right endpoint with Bearer auth', async () => {
    const captured: { value: JsonRequestOptions | null } = { value: null };
    const call = provider(async (options) => {
      captured.value = options;
      return jsonResponse(envelope(PNG_BASE64));
    });
    await call.generate({ prompt: 'a cyberpunk cat' });
    const options = captured.value;
    expect(options).not.toBeNull();
    expect(options?.url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acct-123/ai/run/@cf/black-forest-labs/flux-1-schnell',
    );
    expect(options?.method).toBe('POST');
    expect(options?.headers?.authorization).toBe('Bearer secret-token');
    expect(JSON.parse(String(options?.body))).toEqual({ prompt: 'a cyberpunk cat', steps: 4 });
    expect(options?.retries).toBe(0);
  });

  it('decodes the base64 image and detects the actual format (JPEG bytes, not PNG)', async () => {
    const call = provider(async () => jsonResponse(envelope(JPEG_BASE64)));
    const result = await call.generate({ prompt: 'x' });
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.base64).toBe(JPEG_BASE64);
    expect(result.usage).toBeNull();
    expect(result.parameters).toEqual({ steps: 4, model: '@cf/black-forest-labs/flux-1-schnell' });
  });

  it('detects PNG when PNG bytes are returned', async () => {
    const call = provider(async () => jsonResponse(envelope(PNG_BASE64)));
    expect((await call.generate({ prompt: 'x' })).mimeType).toBe('image/png');
  });

  it('defaults steps to 4 and clamps/overrides within 1..8', async () => {
    const bodies: unknown[] = [];
    const call = provider(async (options) => {
      bodies.push(JSON.parse(String(options.body)));
      return jsonResponse(envelope(PNG_BASE64));
    });
    await call.generate({ prompt: 'x' });
    await call.generate({ prompt: 'x', steps: 8 });
    await call.generate({ prompt: 'x', steps: 99 });
    expect(bodies).toEqual([
      { prompt: 'x', steps: 4 },
      { prompt: 'x', steps: 8 },
      { prompt: 'x', steps: 8 },
    ]);
    expect(clampSteps(undefined)).toBe(4);
    expect(clampSteps(0)).toBe(1);
  });

  it('rejects a prompt over 2048 characters without contacting the provider', async () => {
    let called = false;
    const call = provider(async () => {
      called = true;
      return jsonResponse(envelope(PNG_BASE64));
    });
    await expect(call.generate({ prompt: 'a'.repeat(CLOUDFLARE_MAX_PROMPT_LENGTH + 1) })).rejects.toMatchObject({
      name: 'ImageProviderError',
      kind: 'invalid',
    });
    expect(called).toBe(false);
  });

  it('classifies quota exhaustion vs temporary capacity by error code', () => {
    expect(classifyCloudflareError(3036, 429, '')).toMatchObject({ kind: 'quota' });
    expect(classifyCloudflareError(3040, 429, '')).toMatchObject({ kind: 'capacity' });
    expect(classifyCloudflareError(5035, 403, '')).toMatchObject({ kind: 'plan' });
    expect(classifyCloudflareError(null, 401, 'Authentication error')).toMatchObject({ kind: 'auth' });
    expect(classifyCloudflareError(3007, 408, '')).toMatchObject({ kind: 'timeout' });
    expect(classifyCloudflareError(5007, 400, 'no such model')).toMatchObject({ kind: 'invalid' });
    expect(classifyCloudflareError(null, 500, '')).toMatchObject({ kind: 'other' });
  });

  it('maps a quota envelope (success:false, code 3036) to a quota error and makes no retry', async () => {
    let calls = 0;
    const call = provider(async () => {
      calls += 1;
      return jsonResponse(
        { result: null, success: false, errors: [{ code: 3036, message: 'used up daily free allocation' }] },
        429,
      );
    });
    await expect(call.generate({ prompt: 'x' })).rejects.toMatchObject({ kind: 'quota' });
    expect(calls).toBe(1);
  });

  it('treats a malformed response (no image) as invalid', async () => {
    const call = provider(async () => jsonResponse({ result: {}, success: true, errors: [], messages: [] }));
    await expect(call.generate({ prompt: 'x' })).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('maps provider timeouts to a timeout error', async () => {
    const call = provider(async () => {
      throw new SafeFetchError('timeout', 'Request timed out.');
    });
    await expect(call.generate({ prompt: 'x' })).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('is not configured without both account id and token', () => {
    const unconfigured = new CloudflareImageProvider('', '', 4, async () => jsonResponse(envelope(PNG_BASE64)));
    expect(unconfigured.isConfigured()).toBe(false);
    expect(new CloudflareImageProvider('acct', 'tok').isConfigured()).toBe(true);
  });

  it('rethrows a non-SafeFetch transport error as-is', async () => {
    const call = provider(async () => {
      throw new Error('boom');
    });
    await expect(call.generate({ prompt: 'x' })).rejects.toThrow('boom');
  });

  it('is an ImageProviderError type', () => {
    expect(classifyCloudflareError(3036, 429, '')).toBeInstanceOf(ImageProviderError);
  });
});
