import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  AnalysisProvider,
  type AnalysisModelRequest,
  type AnalysisModelResult,
} from './ai-provider.js';

/**
 * DeepSeek's API is OpenAI-compatible (documented base URL
 * `https://api.deepseek.com`), so the official OpenAI SDK is used purely as the
 * HTTP client. No OpenAI credential is required.
 *
 * Default model: `deepseek-flash` (DeepSeek-V4.1-Flash), the current documented
 * model. Override with DEEPSEEK_MODEL. Structured output uses DeepSeek's JSON
 * Output mode (`response_format: { type: 'json_object' }`); the response is
 * validated against the Zod schema before use.
 */
export const DEFAULT_ANALYSIS_MODEL = 'deepseek-flash';
export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

@Injectable()
export class DeepSeekAnalysisProvider extends AnalysisProvider {
  readonly providerId = 'deepseek';
  readonly model: string;
  private readonly client: OpenAI | null;
  private readonly logger = new Logger(DeepSeekAnalysisProvider.name);

  constructor() {
    super();
    this.model = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_ANALYSIS_MODEL;
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    const baseURL = process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_DEEPSEEK_BASE_URL;
    this.client = apiKey ? new OpenAI({ apiKey, baseURL }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async analyze(request: AnalysisModelRequest): Promise<AnalysisModelResult> {
    if (!this.client) {
      throw new Error('Analysis provider is not configured.');
    }
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
      response_format: { type: 'json_object' },
      max_tokens: request.maxOutputTokens,
    });

    const choice = completion.choices[0];
    if (choice?.message?.refusal) {
      throw new Error('The model refused to produce the analysis.');
    }
    const content = choice?.message?.content;
    if (!content) {
      throw new Error('The model returned no output.');
    }
    this.logger.log(`Analysis completion received (model ${this.model}).`);
    return {
      output: JSON.parse(content),
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  }
}
