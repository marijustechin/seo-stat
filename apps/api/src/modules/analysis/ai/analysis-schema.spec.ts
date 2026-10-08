import { describe, expect, it } from 'vitest';
import { analysisJsonSchema, parseAnalysisOutput } from './analysis-schema.js';

function suggestion(value: string) {
  return {
    value,
    origin: 'website' as const,
    confidence: 'medium' as const,
    sources: [{ url: 'https://example.com', note: 'home page' }],
    rationale: 'because',
  };
}

const valid = {
  businessContext: suggestion('ctx'),
  audienceSegments: [
    {
      name: 'Brands',
      needs: 'n',
      offering: 'o',
      desiredAction: 'd',
      contentDirections: ['c'],
      origin: 'user' as const,
      confidence: 'high' as const,
      sources: [],
    },
  ],
  objectives: suggestion('obj'),
  tone: suggestion('friendly'),
  contentThemes: [{ theme: 'Reuse', rationale: 'r', origin: 'inference' as const, sources: [] }],
  missingInformation: [{ question: 'q', why: 'w' }],
};

describe('analysis output schema', () => {
  it('accepts valid structured output', () => {
    expect(parseAnalysisOutput(valid).audienceSegments[0]?.name).toBe('Brands');
  });

  it('rejects an unknown provenance origin and missing fields', () => {
    expect(() =>
      parseAnalysisOutput({ ...valid, tone: { ...valid.tone, origin: 'guess' } }),
    ).toThrow();
    expect(() => parseAnalysisOutput({ businessContext: valid.businessContext })).toThrow();
  });

  it('produces a strict JSON schema for the provider', () => {
    const schema = analysisJsonSchema();
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(Array.isArray(schema.required)).toBe(true);
  });
});
