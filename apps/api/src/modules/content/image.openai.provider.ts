import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ImageProvider, type ImageGenerationRequest, type ImageGenerationResult } from './image.provider.js';

/**
 * OpenAI Images provider (verified: `POST /v1/images/generations`, models
 * `gpt-image-2.5-sunburst` / `gpt-image-2.5-flare`, returns `b64_json`).
 *
 * This provider is only used when `IMAGE_PROVIDER=openai`. It is separate from
 * the DeepSeek text provider and uses its own `IMAGE_API_KEY`.
 */
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.5-flare';
export const DEFAULT_IMAGE_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_IMAGE_SIZE = '1536x1024';
export const MAX_OPENAI_PROMPT_LENGTH = 32_000;

@Injectable()
export class OpenAiImageProvider extends ImageProvider {
  readonly providerId = 'openai-images';
  readonly model: string;
  readonly maxPromptLength = MAX_OPENAI_PROMPT_LENGTH;
  override readonly defaultParameters: Record<string, unknown>;
  private readonly client: OpenAI | null;
  private readonly logger = new Logger(OpenAiImageProvider.name);

  constructor() {
    super();
    this.model = process.env.IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
    const apiKey = process.env.IMAGE_API_KEY?.trim() || process.env.OPENAI_IMAGE_API_KEY?.trim();
    const baseURL = process.env.IMAGE_BASE_URL?.trim() || DEFAULT_IMAGE_BASE_URL;
    this.defaultParameters = { size: DEFAULT_IMAGE_SIZE, model: this.model };
    this.client = apiKey ? new OpenAI({ apiKey, baseURL }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    if (!this.client) throw new Error('Image provider is not configured.');
    const size = (request.size ?? DEFAULT_IMAGE_SIZE) as '1536x1024';
    const response = await this.client.images.generate({
      model: this.model,
      prompt: request.prompt,
      n: 1,
      size,
    });
    const first = response.data?.[0];
    const base64 = first?.b64_json ?? null;
    if (!base64) throw new Error('The image provider returned no image.');
    this.logger.log(`Image generated (model ${this.model}).`);
    return {
      base64,
      mimeType: 'image/png',
      usage: (response as { usage?: unknown }).usage ?? null,
      parameters: { size, model: this.model },
    };
  }
}
