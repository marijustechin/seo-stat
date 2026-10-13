/** Storage and generation limits for content topics, briefs, and drafts. */
export const CONTENT_LIMITS = {
  maxTopicsPerGeneration: 5,
  title: 200,
  audience: 500,
  objective: 500,
  readerNeed: 1000,
  angle: 1000,
  callToAction: 500,
  relevance: 1000,
  informationNeeded: 1000,
  objectiveAlignment: 500,
  maxRequirements: 10,
  requirementQuestion: 500,
  requirementAnswer: 2000,
  requirementSourceUrl: 2048,
  knowledgeText: 2000,
  outline: 4000,
  excerpt: 500,
  seoTitle: 120,
  metaDescription: 320,
  slug: 120,
  bodyMarkdown: 60000,
  maxSources: 20,
  maxUnresolvedClaims: 20,
  maxOutputTokensTopics: 3000,
  maxOutputTokensArticle: 6000,
  /** Resolutions a single article generation may report for its requirements. */
  maxGapResolutions: 10,
  gapRationale: 500,
  gapUncertainty: 500,
  gapEvidenceUrls: 5,
  gapEvidencePerRecord: 3,
  /**
   * Documented per-run research budget for one article generation. The run makes
   * a single bounded research call; these limits cap what it consumes. Exhausting
   * them leads to rewriting or omission, never to a question for the operator.
   */
  researchMaxPages: 8,
  researchMaxInputChars: 30000,
  /**
   * Internal link planning. The writer may only link to pages from the project's
   * own URL list; these limits bound that list and the links placed per article.
   * The caps are generous on purpose: relevance, not the cap, decides how many
   * links an article uses.
   */
  linkCandidates: 80,
  linkMaxInternal: 6,
  linkMaxExternal: 3,
  sitemapMaxUrls: 500,
} as const;
