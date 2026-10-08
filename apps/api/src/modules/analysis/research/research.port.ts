import type { AnalysisInputSnapshot } from '../analysis.types.js';
import type { PromptResearch } from '../ai/analysis.prompt.js';

/** Research boundary; tests provide a fixture implementation instead of network. */
export abstract class AnalysisResearch {
  abstract collect(snapshot: AnalysisInputSnapshot): Promise<PromptResearch>;
}
