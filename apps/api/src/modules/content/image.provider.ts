export interface ImageGenerationRequest {
  prompt: string;
  size?: string;
}

export interface ImageGenerationResult {
  base64: string;
  mimeType: string;
  usage: unknown;
}

/**
 * Image generation is a separate capability from text. The application text
 * provider is DeepSeek; images use a distinct (optional) provider and credential.
 */
export abstract class ImageProvider {
  abstract readonly providerId: string;
  abstract readonly model: string;
  abstract isConfigured(): boolean;
  abstract generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
