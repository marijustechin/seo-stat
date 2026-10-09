import { CloudflareImageProvider, clampSteps } from './image.cloudflare.provider.js';
import { DisabledImageProvider } from './image.disabled.provider.js';
import { ImageProvider } from './image.provider.js';
import { OpenAiImageProvider } from './image.openai.provider.js';

/**
 * Explicit image-provider selection. Only `IMAGE_PROVIDER=cloudflare` or
 * `IMAGE_PROVIDER=openai` enable a provider; any other value (including unset)
 * yields a disabled provider, so a stray credential cannot trigger requests to a
 * provider that was not chosen.
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
  if (selected === 'openai') return new OpenAiImageProvider();
  return new DisabledImageProvider(selected);
}
