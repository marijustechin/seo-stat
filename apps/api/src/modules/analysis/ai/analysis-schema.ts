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

function clampArray(container: unknown, key: string, max: number): void {
  if (!container || typeof container !== 'object') return;
  const record = container as Record<string, unknown>;
  const value = record[key];
  if (Array.isArray(value) && value.length > max) {
    record[key] = value.slice(0, max);
  }
}

/**
 * Normalize then validate. Models occasionally return slightly over-long arrays;
 * we keep the first N rather than failing an otherwise valid analysis.
 */
export function parseAnalysisOutput(value: unknown): AnalysisOutput {
  const candidate = value;
  if (candidate && typeof candidate === 'object') {
    const record = candidate as Record<string, unknown>;
    clampArray(record, 'audienceSegments', 8);
    clampArray(record, 'contentThemes', 10);
    clampArray(record, 'missingInformation', 10);
    clampArray(record.businessContext, 'sources', 10);
    clampArray(record.objectives, 'sources', 10);
    clampArray(record.tone, 'sources', 10);
    if (Array.isArray(record.audienceSegments)) {
      for (const segment of record.audienceSegments) {
        clampArray(segment, 'sources', 10);
        clampArray(segment, 'contentDirections', 8);
      }
    }
    if (Array.isArray(record.contentThemes)) {
      for (const theme of record.contentThemes) clampArray(theme, 'sources', 10);
    }
  }
  return analysisOutputSchema.parse(candidate);
}
