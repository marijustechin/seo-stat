export interface AnalysisModelRequest {
  system: string;
  user: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
}

export interface AnalysisModelResult {
  output: unknown;
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderStatus {
  provider: string;
  model: string;
  configured: boolean;
}

/**
 * Small interface behind which the AI provider is hidden. This task implements
 * exactly one provider; it is not a multi-provider framework.
 */
export abstract class AnalysisProvider {
  abstract readonly providerId: string;
  abstract readonly model: string;
  abstract isConfigured(): boolean;
  abstract analyze(request: AnalysisModelRequest): Promise<AnalysisModelResult>;
}
