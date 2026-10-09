import { CONTENT_LIMITS } from './content.limits.js';
import type { ArticleOutput } from './content.schemas.js';

interface ClaimRule {
  key: string;
  pattern: RegExp;
  neutral: string;
}

/**
 * Absolute/unsupported claims that must not appear as established facts in the
 * headline, excerpt, SEO fields, or call to action. They are neutralized in
 * those fields and surfaced as unresolved claims for human confirmation.
 */
const CLAIM_RULES: ClaimRule[] = [
  { key: 'zero landfill', pattern: /zero[-\s]?landfill/gi, neutral: 'landfill diversion' },
  {
    key: '100% claim',
    pattern: /\b100\s?%\s?(?:recycl\w*|sustainab\w*|reused|renewable|landfill[-\s]?free)\b/gi,
    neutral: 'high reuse and recycling rates',
  },
  { key: 'carbon neutral', pattern: /carbon[-\s]?neutral/gi, neutral: 'carbon reduction' },
  { key: 'guarantee', pattern: /\bguarantee(?:d|s)?\b/gi, neutral: 'intended' },
  {
    key: 'certification',
    pattern: /\b(?:certified|accredited)\b/gi,
    neutral: 'operating to published standards',
  },
  {
    key: 'superlative',
    pattern: /\b(?:no\.?\s?1|number one|world[-\s]?class|industry[-\s]?leading|best[-\s]?in[-\s]?class)\b/gi,
    neutral: 'experienced',
  },
];

const GUARDED_FIELDS = ['title', 'excerpt', 'seoTitle', 'metaDescription', 'callToAction'] as const;

export interface ClaimGuardResult {
  output: ArticleOutput;
  notes: string[];
}

export function guardArticleClaims(output: ArticleOutput): ClaimGuardResult {
  const notes: string[] = [];
  const next: ArticleOutput = { ...output, unresolvedClaims: [...output.unresolvedClaims] };

  for (const field of GUARDED_FIELDS) {
    let value = next[field];
    let changed = false;
    for (const rule of CLAIM_RULES) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(value)) {
        value = value.replace(rule.pattern, rule.neutral);
        changed = true;
        const alreadyNoted = next.unresolvedClaims.some((claim) =>
          claim.toLowerCase().includes(rule.key.toLowerCase()),
        );
        if (!alreadyNoted) {
          const note = `The ${field} used an unverified claim ("${rule.key}"). Neutral wording was substituted; confirm supporting evidence before publication.`;
          next.unresolvedClaims.push(note);
          notes.push(note);
        }
      }
      rule.pattern.lastIndex = 0;
    }
    if (changed) next[field] = value;
  }

  if (next.unresolvedClaims.length > CONTENT_LIMITS.maxUnresolvedClaims) {
    next.unresolvedClaims = next.unresolvedClaims.slice(0, CONTENT_LIMITS.maxUnresolvedClaims);
  }
  return { output: next, notes };
}
