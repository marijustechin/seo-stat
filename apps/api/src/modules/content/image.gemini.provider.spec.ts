import { describe, expect, it } from 'vitest';
import type { GeminiGenerate } from './image.gemini.client.js';
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  GEMINI_MAX_PROMPT_LENGTH,
  GeminiImageProvider,
  classifyGeminiError,
} from './image.gemini.provider.js';
import { ImageProviderError } from './image.provider.js';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]).toString('base64');

function imageResult(base64: string, usage: unknown = { totalTokenCount: 1290 }) {
  return { parts: [{ inlineData: { data: base64, mimeType: 'image/png' } }], usage };
}

function provider(generateFn: GeminiGenerate) {
  return new GeminiImageProvider('test-key', 'gemini-3.1-flash-image', generateFn);
}

describe('GeminiImageProvider', () => {
  it('requests a landscape 16:9 image and decodes the inlineData', async () => {
    const calls: Array<{ model: string; prompt: string; aspectRatio: string }> = [];
    const result = await provider(async (request) => {
      calls.push(request);
      return imageResult(PNG_BASE64);
    }).generate({ prompt: 'a calm editorial illustration' });

    expect(calls).toEqual([
      { model: 'gemini-3.1-flash-image', prompt: 'a calm editorial illustration', aspectRatio: '16:9' },
    ]);
    expect(result.mimeType).toBe('image/png');
    expect(result.base64).toBe(PNG_BASE64);
    expect(result.parameters).toEqual({ aspectRatio: '16:9', model: 'gemini-3.1-flash-image' });
    expect(result.usage).toEqual({ totalTokenCount: 1290 });
  });

  it('detects the actual format (JPEG bytes, not a PNG hint)', async () => {
    const result = await provider(async () => imageResult(JPEG_BASE64)).generate({ prompt: 'x' });
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('rejects a text-only response (no image)', async () => {
    await expect(
      provider(async () => ({ parts: [{ text: 'I cannot create that image.' }], usage: null })).generate({
        prompt: 'x',
      }),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('rejects empty and over-length prompts without calling the provider', async () => {
    let called = false;
    const call = provider(async () => {
      called = true;
      return imageResult(PNG_BASE64);
    });
    await expect(call.generate({ prompt: '   ' })).rejects.toMatchObject({ kind: 'invalid' });
    await expect(call.generate({ prompt: 'a'.repeat(GEMINI_MAX_PROMPT_LENGTH + 1) })).rejects.toMatchObject({
      kind: 'invalid',
    });
    expect(called).toBe(false);
  });

  it('classifies quota, auth, capacity, and invalid errors', () => {
    const quota = Object.assign(new Error('429 RESOURCE_EXHAUSTED'), { status: 429 });
    expect(classifyGeminiError(quota)).toMatchObject({ kind: 'quota' });
    const auth = Object.assign(new Error('403 PERMISSION_DENIED'), { status: 403 });
    expect(classifyGeminiError(auth)).toMatchObject({ kind: 'auth' });
    const capacity = Object.assign(new Error('503 UNAVAILABLE'), { status: 503 });
    expect(classifyGeminiError(capacity)).toMatchObject({ kind: 'capacity' });
    const invalid = Object.assign(new Error('400 INVALID_ARGUMENT'), { status: 400 });
    expect(classifyGeminiError(invalid)).toMatchObject({ kind: 'invalid' });
  });

  it('surfaces a classified provider error when the SDK throws', async () => {
    const call = provider(async () => {
      throw Object.assign(new Error('429 RESOURCE_EXHAUSTED'), { status: 429 });
    });
    await expect(call.generate({ prompt: 'x' })).rejects.toBeInstanceOf(ImageProviderError);
    await expect(call.generate({ prompt: 'x' })).rejects.toMatchObject({ kind: 'quota' });
  });

  it('is unconfigured without a key and reports a clear error', async () => {
    const unconfigured = new GeminiImageProvider('', DEFAULT_GEMINI_IMAGE_MODEL);
    expect(unconfigured.isConfigured()).toBe(false);
    await expect(unconfigured.generate({ prompt: 'x' })).rejects.toMatchObject({ kind: 'auth' });
  });

  it('uses the configured default model', () => {
    expect(new GeminiImageProvider('key').model).toBe(DEFAULT_GEMINI_IMAGE_MODEL);
    expect(new GeminiImageProvider('key', 'gemini-custom').model).toBe('gemini-custom');
  });
});
