import { describe, expect, it } from 'vitest';
import { validateSuggestionValues, type SuggestionSelection, type SuggestionValues } from './suggestion-limits';

const none: SuggestionSelection = {
  businessContext: false,
  audience: false,
  objectives: false,
  tone: false,
};

function values(partial: Partial<SuggestionValues>): SuggestionValues {
  return { businessContext: '', audience: '', objectives: '', tone: '', ...partial };
}

describe('validateSuggestionValues', () => {
  it('accepts an overlong tone when it is not selected', () => {
    const errors = validateSuggestionValues(none, values({ tone: 'x'.repeat(400) }));
    expect(errors).toEqual({});
  });

  it('flags a selected tone over the 120-character limit', () => {
    const errors = validateSuggestionValues({ ...none, tone: true }, values({ tone: 'x'.repeat(121) }));
    expect(errors.tone).toContain('120');
  });

  it('accepts a selected tone at the limit and rejects empty selected fields', () => {
    expect(validateSuggestionValues({ ...none, tone: true }, values({ tone: 'x'.repeat(120) }))).toEqual({});
    const errors = validateSuggestionValues({ ...none, businessContext: true }, values({}));
    expect(errors.businessContext).toBeTruthy();
  });
});
