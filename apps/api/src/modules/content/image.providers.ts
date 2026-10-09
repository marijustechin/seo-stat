import { CloudflareImageProvider, clampSteps } from './image.cloudflare.provider.js';
import { DisabledImageProvider } from './image.disabled.provider.js';
import { DEFAULT_GEMINI_IMAGE_MODEL, GeminiImageProvider } from './image.gemini.provider.js';
import { ImageProvider } from './image.provider.js';
import { OpenAiImageProvider } from './image.openai.provider.js';

/**
 * Explicit image-provider selection. Only `IMAGE_PROVIDER=cloudflare`,
 * `IMAGE_PROVIDER=gemini`, or `IMAGE_PROVIDER=openai` enable a provider; any
 * other value (including unset) yields a disabled provider, so a stray
 * credential cannot trigger requests to a provider that was not chosen. There is
 * no automatic fallback between providers.
 */
export function createImageProvider(env: NodeJS.ProcessEnv = process.env): ImageProvider {
  const selected = (env.IMAGE_PROVIDER ?? '').trim().toLowerCase();
  if (selected === 'cloudflare') {
    return new CloudflareImageProvider(
      env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? '',
      env.CLOUDFLARE_API_TOKEN?.trim() ?? '',
      clampSteps(env.IMAGE_STEPS),
    );
  }
  if (selected === 'gemini') {
    return new GeminiImageProvider(
      env.GEMINI_API_KEY?.trim() ?? '',
      env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL,
    );
  }
  if (selected === 'openai') return new OpenAiImageProvider();
  return new DisabledImageProvider(selected);
}
