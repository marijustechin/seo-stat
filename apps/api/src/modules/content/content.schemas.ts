import { z } from 'zod';
import { CONTENT_LIMITS } from './content.limits.js';

const sourceRef = z.strictObject({
  url: z.string().max(2048),
  note: z.string().max(500),
  retrievedAt: z.string().max(40).optional(),
});

const topic = z.strictObject({
  title: z.string().max(CONTENT_LIMITS.title),
  audience: z.string().max(CONTENT_LIMITS.audience),
  objective: z.string().max(CONTENT_LIMITS.objective),
  readerNeed: z.string().max(CONTENT_LIMITS.readerNeed),
  angle: z.string().max(CONTENT_LIMITS.angle),
  callToAction: z.string().max(CONTENT_LIMITS.callToAction),
  relevance: z.string().max(CONTENT_LIMITS.relevance),
  informationNeeded: z.string().max(CONTENT_LIMITS.informationNeeded),
  objectiveAlignment: z.string().max(CONTENT_LIMITS.objectiveAlignment),
  priority: z.enum(['primary', 'secondary', 'supporting']),
  sources: z.array(sourceRef).max(CONTENT_LIMITS.maxSources),
});

const topicsOutput = z.strictObject({
  topics: z.array(topic).min(1).max(CONTENT_LIMITS.maxTopicsPerGeneration),
});

const articleOutput = z.strictObject({
  title: z.string().max(CONTENT_LIMITS.title),
  excerpt: z.string().max(CONTENT_LIMITS.excerpt),
  bodyMarkdown: z.string().max(CONTENT_LIMITS.bodyMarkdown),
  slug: z.string().max(CONTENT_LIMITS.slug),
  seoTitle: z.string().max(CONTENT_LIMITS.seoTitle),
  metaDescription: z.string().max(CONTENT_LIMITS.metaDescription),
  callToAction: z.string().max(CONTENT_LIMITS.callToAction),
  sources: z.array(sourceRef).max(CONTENT_LIMITS.maxSources),
  unresolvedClaims: z.array(z.string().max(500)).max(CONTENT_LIMITS.maxUnresolvedClaims),
});

export type TopicSuggestion = z.infer<typeof topic>;
export type TopicsOutput = z.infer<typeof topicsOutput>;
export type ArticleOutput = z.infer<typeof articleOutput>;

function clampArray(container: unknown, key: string, max: number): void {
  if (!container || typeof container !== 'object') return;
  const record = container as Record<string, unknown>;
  const value = record[key];
  if (Array.isArray(value) && value.length > max) record[key] = value.slice(0, max);
}

export function parseTopicsOutput(value: unknown): TopicsOutput {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    clampArray(record, 'topics', CONTENT_LIMITS.maxTopicsPerGeneration);
    if (Array.isArray(record.topics)) for (const item of record.topics) clampArray(item, 'sources', CONTENT_LIMITS.maxSources);
  }
  return topicsOutput.parse(value);
}

export function parseArticleOutput(value: unknown): ArticleOutput {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    clampArray(record, 'sources', CONTENT_LIMITS.maxSources);
    clampArray(record, 'unresolvedClaims', CONTENT_LIMITS.maxUnresolvedClaims);
  }
  return articleOutput.parse(value);
}

export function topicsJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(topicsOutput) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

export function articleJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(articleOutput) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
