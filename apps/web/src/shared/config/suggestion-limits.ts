export const SUGGESTION_LIMITS = {
  businessContext: 4000,
  audience: 4000,
  objectives: 4000,
  tone: 120,
} as const;

export type AppliedField = keyof typeof SUGGESTION_LIMITS;

export const APPLIED_FIELD_LABELS: Record<AppliedField, string> = {
  businessContext: 'Business context',
  audience: 'Audience',
  objectives: 'Objectives',
  tone: 'Tone',
};

export const TONE_HELP =
  'Tone must be a concise instruction (max 120 characters). Longer explanations belong in the rationale.';

export interface SuggestionSelection {
  businessContext: boolean;
  audience: boolean;
  objectives: boolean;
  tone: boolean;
}

export interface SuggestionValues {
  businessContext: string;
  audience: string;
  objectives: string;
  tone: string;
}

export type SuggestionErrors = Partial<Record<AppliedField, string>>;

/** Validate selected suggestion values against the same limits the API enforces. */
export function validateSuggestionValues(
  selection: SuggestionSelection,
  values: SuggestionValues,
): SuggestionErrors {
  const errors: SuggestionErrors = {};
  for (const field of Object.keys(SUGGESTION_LIMITS) as AppliedField[]) {
    if (!selection[field]) continue;
    const value = values[field] ?? '';
    if (value.trim().length === 0) {
      errors[field] = 'A value is required when this field is selected.';
      continue;
    }
    if (value.length > SUGGESTION_LIMITS[field]) {
      errors[field] = `Must be ${SUGGESTION_LIMITS[field]} characters or fewer (currently ${value.length}).`;
    }
  }
  return errors;
}
