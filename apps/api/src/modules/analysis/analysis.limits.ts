/**
 * Concrete, documented bounds for one analysis run. These are intentionally
 * small: the goal is a bounded reading of a few relevant public pages, not a
 * crawl. They are shown to the user before starting and enforced in code.
 */
export const ANALYSIS_LIMITS = {
  /** Maximum number of competitor sites per project. */
  maxCompetitors: 5,
  /** Pages read from the project website (including the home page). */
  maxProjectPages: 6,
  /** Pages read per competitor site. */
  maxCompetitorPages: 3,
  /** Hard cap across the project site and all competitors. */
  maxTotalPages: 15,
  /** Maximum redirects followed per request. */
  maxRedirects: 4,
  /** Maximum bytes read per page. */
  maxResponseBytes: 2_000_000,
  /** Per-request timeout in milliseconds. */
  requestTimeoutMs: 10_000,
  /** Retries for transient network failures. */
  maxRetries: 1,
  /** Maximum characters per page after text extraction. */
  maxCharsPerPage: 8_000,
  /** Maximum total research characters sent to the model. */
  maxInputChars: 60_000,
  /** Maximum tokens requested from the model. */
  maxOutputTokens: 2_500,
} as const;

export function describeAnalysisScope(): string {
  return [
    `Reads up to ${ANALYSIS_LIMITS.maxProjectPages} pages from your website`,
    `and up to ${ANALYSIS_LIMITS.maxCompetitorPages} pages from each of up to ${ANALYSIS_LIMITS.maxCompetitors} competitor sites`,
    `(at most ${ANALYSIS_LIMITS.maxTotalPages} pages total).`,
    'Only public pages, respecting the objectives and context you already provided.',
  ].join(' ');
}
