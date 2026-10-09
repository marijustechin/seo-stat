import { ImageProvider, ImageProviderError, type ImageGenerationResult } from './image.provider.js';

/**
 * Placeholder when no image provider is explicitly selected. It is never
 * "configured", so generation returns 503 without contacting any provider. This
 * is what prevents an incidental IMAGE_API_KEY from silently using OpenAI.
 */
export class DisabledImageProvider extends ImageProvider {
  readonly providerId: string;
  readonly model = 'none';
  readonly maxPromptLength = null;

  constructor(requested: string = 'none') {
    super();
    this.providerId = requested.length > 0 ? requested : 'none';
  }

  isConfigured(): boolean {
    return false;
  }

  async generate(): Promise<ImageGenerationResult> {
    throw new ImageProviderError(
      'auth',
      'No image provider is selected on the server. Set IMAGE_PROVIDER (for example, IMAGE_PROVIDER=cloudflare).',
    );
  }
}
