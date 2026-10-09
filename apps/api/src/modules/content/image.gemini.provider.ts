import { Injectable } from '@nestjs/common';
import { detectImageMime } from './image-meta.js';
import { createGeminiGenerate, type GeminiGenerate, type GeminiImageResult } from './image.gemini.client.js';
import {
  ImageProvider,
  ImageProviderError,
  type ImageGenerationRequest,
  type ImageGenerationResult,
} from './image.provider.js';

/**
 * Google Gemini image generation provider (official `@google/genai` SDK).
 * Default model `gemini-3.1-flash-image`, landscape `16:9` covers. Selected only
 * with `IMAGE_PROVIDER=gemini`; DeepSeek remains the text provider and no other
 * image provider is used as a fallback.
 */
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const GEMINI_ASPECT_RATIO = '16:9';
export const GEMINI_MAX_PROMPT_LENGTH = 48_000;

function sanitize(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * Classify an SDK error without echoing its raw text (which could be verbose or
 * contain request context): only recognized reason tokens and the HTTP status
 * are used to build the message.
 */
export function classifyGeminiError(error: unknown): ImageProviderError {
  const status = (error as { status?: unknown })?.status;
  const httpStatus = typeof status === 'number' ? status : null;
  const text = (error instanceof Error ? error.message : String(error ?? '')).toUpperCase();
  if (httpStatus === 429 || text.includes('RESOURCE_EXHAUSTED') || text.includes('QUOTA') || text.includes('RATE')) {
    return new ImageProviderError(
      'quota',
      'Gemini image generation quota or rate limit was exceeded. It will not be retried; try again later.',
    );
  }
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    text.includes('UNAUTHENTICATED') ||
    text.includes('PERMISSION_DENIED') ||
    text.includes('API_KEY')
  ) {
    return new ImageProviderError(
      'auth',
      'Gemini rejected the API key or it lacks permission to generate images. Check GEMINI_API_KEY.',
    );
  }
  if (httpStatus === 503 || httpStatus === 504 || text.includes('UNAVAILABLE') || text.includes('DEADLINE')) {
    return new ImageProviderError('capacity', 'Gemini is temporarily unavailable or overloaded. Try again shortly.');
  }
  if (httpStatus === 400 || text.includes('INVALID_ARGUMENT')) {
    return new ImageProviderError('invalid', 'Gemini rejected the image request as invalid.');
  }
  const detail = sanitize(error instanceof Error ? error.message : '');
  return new ImageProviderError(
    'other',
    detail ? `Gemini image generation failed: ${detail}` : 'Gemini image generation failed.',
  );
}

@Injectable()
export class GeminiImageProvider extends ImageProvider {
  readonly providerId = 'gemini';
  readonly model: string;
  readonly maxPromptLength = GEMINI_MAX_PROMPT_LENGTH;
  override readonly defaultParameters: Record<string, unknown>;
  private readonly generateFn: GeminiGenerate | null;

  constructor(
    apiKey: string = process.env.GEMINI_API_KEY?.trim() ?? '',
    model: string = process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL,
    generateFn?: GeminiGenerate,
  ) {
    super();
    this.model = model;
    this.defaultParameters = { aspectRatio: GEMINI_ASPECT_RATIO, model };
    this.generateFn = generateFn ?? (apiKey ? createGeminiGenerate(apiKey) : null);
  }

  isConfigured(): boolean {
    return this.generateFn !== null;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.generateFn) {
      throw new ImageProviderError('auth', 'Gemini image generation is not configured on the server.');
    }
    const prompt = request.prompt;
    if (prompt.trim().length === 0) {
      throw new ImageProviderError('invalid', 'The prompt must not be empty.');
    }
    if (prompt.length > this.maxPromptLength) {
      throw new ImageProviderError(
        'invalid',
        `The prompt is ${prompt.length} characters; Gemini accepts at most ${this.maxPromptLength}.`,
      );
    }

    let result: GeminiImageResult;
    try {
      result = await this.generateFn({ model: this.model, prompt, aspectRatio: GEMINI_ASPECT_RATIO });
    } catch (error) {
      throw classifyGeminiError(error);
    }

    const imagePart = result.parts.find(
      (part) => typeof part.inlineData?.data === 'string' && part.inlineData.data.length > 0,
    );
    if (!imagePart?.inlineData?.data) {
      throw new ImageProviderError(
        'invalid',
        'Gemini returned no image (it may have refused the prompt or replied with text only).',
      );
    }
    const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const mimeType = detectImageMime(buffer);
    if (!mimeType) {
      throw new ImageProviderError('invalid', 'Gemini returned an image in an unsupported format.');
    }
    return {
      base64: imagePart.inlineData.data,
      mimeType,
      usage: result.usage ?? null,
      parameters: { aspectRatio: GEMINI_ASPECT_RATIO, model: this.model },
    };
  }
}
