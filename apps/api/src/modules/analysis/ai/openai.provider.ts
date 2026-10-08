import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  AnalysisProvider,
  type AnalysisModelRequest,
  type AnalysisModelResult,
} from './ai-provider.js';

/**
 * Default model. `gpt-6.1-sol` is documented by OpenAI as the balance of
 * intelligence and cost; override with OPENAI_MODEL. See docs/deployment.md for
 * the price basis used to estimate cost.
 */
export const DEFAULT_ANALYSIS_MODEL = 'gpt-6.1-sol';

@Injectable()
export class OpenAiAnalysisProvider extends AnalysisProvider {
  readonly providerId = 'openai';
  readonly model: string;
  private readonly client: OpenAI | null;
  private readonly logger = new Logger(OpenAiAnalysisProvider.name);

  constructor() {
    super();
    this.model = process.env.OPENAI_MODEL?.trim() || DEFAULT_ANALYSIS_MODEL;
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const baseURL = process.env.OPENAI_BASE_URL?.trim();
    this.client = apiKey ? new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) }) : null;
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
      response_format: {
        type: 'json_schema',
        json_schema: { name: request.schemaName, strict: true, schema: request.jsonSchema },
      },
      max_completion_tokens: request.maxOutputTokens,
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
