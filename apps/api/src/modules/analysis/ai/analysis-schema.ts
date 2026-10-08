import { z } from 'zod';

export const SUGGESTION_ORIGINS = ['user', 'website', 'competitor', 'inference'] as const;
export type SuggestionOrigin = (typeof SUGGESTION_ORIGINS)[number];

const sourceRef = z.strictObject({
  url: z.string().max(2048),
  note: z.string().max(500),
});

const origin = z.enum(SUGGESTION_ORIGINS);
const confidence = z.enum(['low', 'medium', 'high']);

const suggestion = z.strictObject({
  value: z.string().max(2000),
  origin,
  confidence,
  sources: z.array(sourceRef).max(10),
  rationale: z.string().max(1000),
});

const audienceSegment = z.strictObject({
  name: z.string().max(200),
  needs: z.string().max(1000),
  offering: z.string().max(1000),
  desiredAction: z.string().max(500),
  contentDirections: z.array(z.string().max(300)).max(8),
  origin,
  confidence,
  sources: z.array(sourceRef).max(10),
});

const contentTheme = z.strictObject({
  theme: z.string().max(300),
  rationale: z.string().max(1000),
  origin,
  sources: z.array(sourceRef).max(10),
});

const missingInformation = z.strictObject({
  question: z.string().max(500),
  why: z.string().max(1000),
});

export const analysisOutputSchema = z.strictObject({
  businessContext: suggestion,
  audienceSegments: z.array(audienceSegment).min(1).max(8),
  objectives: suggestion,
  tone: suggestion,
  contentThemes: z.array(contentTheme).min(1).max(10),
  missingInformation: z.array(missingInformation).max(10),
});

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;

/** JSON Schema for the provider's structured output, without the $schema key. */
export function analysisJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(analysisOutputSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

export function parseAnalysisOutput(value: unknown): AnalysisOutput {
  return analysisOutputSchema.parse(value);
}
