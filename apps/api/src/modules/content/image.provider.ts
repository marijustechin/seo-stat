export interface ImageGenerationRequest {
  prompt: string;
  size?: string;
  /** Diffusion steps, where the provider supports them (Cloudflare FLUX). */
  steps?: number;
}

export interface ImageGenerationResult {
  base64: string;
  mimeType: string;
  /** Any usage actually reported by the provider; `null` when it reports none. */
  usage: unknown;
  /** The generation parameters actually submitted (for the record). */
  parameters?: unknown;
}

export type ImageProviderErrorKind =
  | 'quota'
  | 'capacity'
  | 'plan'
  | 'auth'
  | 'invalid'
  | 'timeout'
  | 'network'
  | 'other';

/** A provider failure classified so the service can map it to a clear response. */
export class ImageProviderError extends Error {
  constructor(
    readonly kind: ImageProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ImageProviderError';
  }
}

/**
 * Image generation is a separate capability from text. The application text
 * provider is DeepSeek; images use an explicitly selected provider and its own
 * credential.
 */
export abstract class ImageProvider {
  abstract readonly providerId: string;
  abstract readonly model: string;
  /** Maximum accepted prompt length, or null when the provider imposes none here. */
  abstract readonly maxPromptLength: number | null;
  /** Default generation parameters, shown in status. */
  readonly defaultParameters?: Record<string, unknown>;
  abstract isConfigured(): boolean;
  abstract generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
