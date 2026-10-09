import { describe, expect, it } from 'vitest';
import { CloudflareImageProvider } from './image.cloudflare.provider.js';
import { DisabledImageProvider } from './image.disabled.provider.js';
import { OpenAiImageProvider } from './image.openai.provider.js';
import { createImageProvider } from './image.providers.js';

describe('image provider selection', () => {
  it('selects Cloudflare only when explicitly requested', () => {
    const selected = createImageProvider({
      IMAGE_PROVIDER: 'cloudflare',
      CLOUDFLARE_ACCOUNT_ID: 'acct',
      CLOUDFLARE_API_TOKEN: 'tok',
    } as NodeJS.ProcessEnv);
    expect(selected).toBeInstanceOf(CloudflareImageProvider);
    expect(selected.providerId).toBe('cloudflare');
    expect(selected.isConfigured()).toBe(true);
    expect(selected.maxPromptLength).toBe(2048);
    expect(selected.defaultParameters).toEqual({ steps: 4 });
  });

  it('honours IMAGE_STEPS for the default Cloudflare steps', () => {
    const selected = createImageProvider({
      IMAGE_PROVIDER: 'cloudflare',
      CLOUDFLARE_ACCOUNT_ID: 'acct',
      CLOUDFLARE_API_TOKEN: 'tok',
      IMAGE_STEPS: '6',
    } as NodeJS.ProcessEnv);
    expect(selected.defaultParameters).toEqual({ steps: 6 });
  });

  it('reports Cloudflare as unconfigured when credentials are missing', () => {
    const selected = createImageProvider({ IMAGE_PROVIDER: 'cloudflare' } as NodeJS.ProcessEnv);
    expect(selected).toBeInstanceOf(CloudflareImageProvider);
    expect(selected.isConfigured()).toBe(false);
  });

  it('selects OpenAI only when explicitly requested', () => {
    expect(createImageProvider({ IMAGE_PROVIDER: 'openai' } as NodeJS.ProcessEnv)).toBeInstanceOf(
      OpenAiImageProvider,
    );
  });

  it('does not fall back to OpenAI when an IMAGE_API_KEY is present but no provider is selected', () => {
    const selected = createImageProvider({ IMAGE_API_KEY: 'sk-existing' } as NodeJS.ProcessEnv);
    expect(selected).toBeInstanceOf(DisabledImageProvider);
    expect(selected.isConfigured()).toBe(false);
    expect(selected.providerId).toBe('none');
  });

  it('never selects OpenAI when cloudflare is chosen even if IMAGE_API_KEY is present', () => {
    const selected = createImageProvider({
      IMAGE_PROVIDER: 'cloudflare',
      IMAGE_API_KEY: 'sk-existing',
      CLOUDFLARE_ACCOUNT_ID: 'acct',
      CLOUDFLARE_API_TOKEN: 'tok',
    } as NodeJS.ProcessEnv);
    expect(selected).toBeInstanceOf(CloudflareImageProvider);
  });

  it('reports an unsupported provider as disabled with the requested name', () => {
    const selected = createImageProvider({ IMAGE_PROVIDER: 'azure' } as NodeJS.ProcessEnv);
    expect(selected).toBeInstanceOf(DisabledImageProvider);
    expect(selected.providerId).toBe('azure');
    expect(selected.isConfigured()).toBe(false);
  });
});
