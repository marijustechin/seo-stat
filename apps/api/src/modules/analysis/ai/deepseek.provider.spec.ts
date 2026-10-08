import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_ANALYSIS_MODEL, DeepSeekAnalysisProvider } from './deepseek.provider.js';

const original = {
  key: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL,
  base: process.env.DEEPSEEK_BASE_URL,
};

afterEach(() => {
  for (const [name, value] of [
    ['DEEPSEEK_API_KEY', original.key],
    ['DEEPSEEK_MODEL', original.model],
    ['DEEPSEEK_BASE_URL', original.base],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('DeepSeekAnalysisProvider', () => {
  it('is unconfigured without DEEPSEEK_API_KEY and uses the documented default model', () => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_MODEL;
    const provider = new DeepSeekAnalysisProvider();
    expect(provider.providerId).toBe('deepseek');
    expect(provider.isConfigured()).toBe(false);
    expect(provider.model).toBe(DEFAULT_ANALYSIS_MODEL);
    expect(DEFAULT_ANALYSIS_MODEL).toBe('deepseek-flash');
  });

  it('is configured from DEEPSEEK_API_KEY and honours DEEPSEEK_MODEL', () => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-v4-pro';
    const provider = new DeepSeekAnalysisProvider();
    expect(provider.isConfigured()).toBe(true);
    expect(provider.model).toBe('deepseek-v4-pro');
  });
});
