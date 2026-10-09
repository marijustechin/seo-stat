import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/index.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AnalysisProvider } from '../analysis/ai/ai-provider.js';
import type { AnalysisInputSnapshot } from '../analysis/analysis.types.js';
import { AnalysisResearch } from '../analysis/research/research.port.js';
import { CONTENT_LIMITS } from './content.limits.js';
import {
  articleJsonSchema,
  parseArticleOutput,
  parseTopicsOutput,
  topicsJsonSchema,
} from './content.schemas.js';
import { buildArticlePrompt, buildTopicPrompt } from './content.prompts.js';
import { guardArticleClaims } from './content.claims.js';
import type { BriefSnapshot, ContentSettingsSnapshot } from './content.types.js';

function estimateCost(inputTokens: number, outputTokens: number): number | null {
  const inputPrice = Number.parseFloat(process.env.ANALYSIS_COST_INPUT_PER_MTOK ?? '');
  const outputPrice = Number.parseFloat(process.env.ANALYSIS_COST_OUTPUT_PER_MTOK ?? '');
  if (!Number.isFinite(inputPrice) || !Number.isFinite(outputPrice)) return null;
  return (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice;
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Generation failed.';
  const redacted = raw
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[redacted-address]')
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[redacted-url]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  return redacted.length > 0 ? redacted : 'Generation failed.';
}

interface ArticleSnapshot {
  settings: ContentSettingsSnapshot;
  brief: BriefSnapshot;
  research: AnalysisInputSnapshot;
}

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * In-process asynchronous runner for topic and article generation. Persists the
 * run before enqueuing and marks stale runs interrupted on startup.
 */
@Injectable()
export class ContentRunner implements OnModuleInit {
  private readonly logger = new Logger(ContentRunner.name);
  private readonly queue: string[] = [];
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AnalysisProvider,
    private readonly research: AnalysisResearch,
  ) {}

  async onModuleInit(): Promise<void> {
    const result = await this.prisma.contentRun.updateMany({
      where: { status: { in: ['queued', 'running'] } },
      data: {
        status: 'interrupted',
        finishedAt: new Date(),
        error: 'Interrupted by a service restart. Start the generation again to retry.',
      },
    });
    if (result.count > 0) this.logger.warn(`Marked ${result.count} interrupted content run(s).`);
  }

  enqueue(runId: string): void {
    this.queue.push(runId);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const id = this.queue.shift();
        if (id) await this.process(id);
      }
    } finally {
      this.processing = false;
    }
  }

  private async priorAnalysisEvidence(projectId: string) {
    const run = await this.prisma.analysisRun.findFirst({
      where: { projectId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });
    const evidence = (run?.evidence ?? null) as { pages?: Array<{ url: string; title: string; fetchedAt: string; excerpt: string }> } | null;
    return { pages: evidence?.pages ?? [] };
  }

  private async processTopics(runId: string, run: { projectId: string; inputSnapshot: unknown }): Promise<void> {
    const snapshot = run.inputSnapshot as unknown as ContentSettingsSnapshot;
    const evidence = await this.priorAnalysisEvidence(run.projectId);
    const { system, user } = buildTopicPrompt(snapshot, evidence);
    const model = await this.provider.analyze({
      system,
      user,
      schemaName: 'content_topics',
      jsonSchema: topicsJsonSchema(),
      maxOutputTokens: CONTENT_LIMITS.maxOutputTokensTopics,
    });
    const output = parseTopicsOutput(model.output);

    const existing = await this.prisma.contentTopic.findMany({
      where: { projectId: run.projectId },
      select: { title: true },
    });
    const seen = new Set(existing.map((topic) => normalizeTitle(topic.title)));
    let created = 0;
    for (const suggestion of output.topics) {
      const key = normalizeTitle(suggestion.title);
      if (seen.has(key)) continue;
      seen.add(key);
      await this.prisma.contentTopic.create({
        data: {
          projectId: run.projectId,
          title: suggestion.title,
          audience: suggestion.audience,
          objective: suggestion.objective,
          readerNeed: suggestion.readerNeed,
          angle: suggestion.angle,
          callToAction: suggestion.callToAction,
          relevance: suggestion.relevance,
          informationNeeded: suggestion.informationNeeded,
          objectiveAlignment: suggestion.objectiveAlignment,
          priority: suggestion.priority,
          origin: 'generated',
          generationRunId: runId,
          sources: suggestion.sources as unknown as Prisma.InputJsonValue,
        },
      });
      created += 1;
    }
    await this.complete(runId, model, { createdTopics: created });
  }

  private async processArticle(
    runId: string,
    run: { projectId: string; topicId: string | null; inputSnapshot: unknown },
  ): Promise<void> {
    const resolvedTopicId = run.topicId ?? '';
    const snapshot = run.inputSnapshot as unknown as ArticleSnapshot;
    const research = await this.research.collect(snapshot.research);
    const { system, user } = buildArticlePrompt(snapshot.settings, snapshot.brief, research);
    const model = await this.provider.analyze({
      system,
      user,
      schemaName: 'content_article',
      jsonSchema: articleJsonSchema(),
      maxOutputTokens: CONTENT_LIMITS.maxOutputTokensArticle,
    });
    const parsed = parseArticleOutput(model.output);
    const { output } = guardArticleClaims(parsed);

    const brief = await this.prisma.articleBrief.findFirst({ where: { projectId: run.projectId, topicId: resolvedTopicId } });
    const aggregate = await this.prisma.articleDraft.aggregate({
      where: { topicId: resolvedTopicId },
      _max: { version: true },
    });
    const version = (aggregate._max.version ?? 0) + 1;
    const draft = await this.prisma.articleDraft.create({
      data: {
        projectId: run.projectId,
        topicId: resolvedTopicId,
        briefId: brief?.id ?? null,
        version,
        status: 'draft',
        title: output.title,
        excerpt: output.excerpt,
        bodyMarkdown: output.bodyMarkdown,
        slug: output.slug,
        seoTitle: output.seoTitle,
        metaDescription: output.metaDescription,
        callToAction: output.callToAction,
        sources: output.sources as unknown as Prisma.InputJsonValue,
        unresolvedClaims: output.unresolvedClaims as unknown as Prisma.InputJsonValue,
        settingsSnapshot: snapshot.settings as unknown as Prisma.InputJsonValue,
        briefSnapshot: snapshot.brief as unknown as Prisma.InputJsonValue,
        generationRunId: runId,
      },
    });
    await this.complete(runId, model, { draftId: draft.id, version }, {
      backend: research.backend,
      firecrawlCredits: research.firecrawlCredits,
      pages: research.pages,
      failures: research.failures,
      websiteReadable: research.websiteReadable,
    });
    await this.prisma.contentRun.update({ where: { id: runId }, data: { draftId: draft.id } });
  }

  private async complete(
    runId: string,
    model: { inputTokens: number; outputTokens: number },
    result: Record<string, unknown>,
    evidence?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.contentRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        provider: this.provider.providerId,
        model: this.provider.model,
        inputTokens: model.inputTokens,
        outputTokens: model.outputTokens,
        estimatedCostUsd: estimateCost(model.inputTokens, model.outputTokens),
        result: result as unknown as Prisma.InputJsonValue,
        ...(evidence ? { evidence: evidence as unknown as Prisma.InputJsonValue } : {}),
        error: null,
      },
    });
  }

  private async process(runId: string): Promise<void> {
    const run = await this.prisma.contentRun.findUnique({ where: { id: runId } });
    if (!run || run.status !== 'queued') return;
    await this.prisma.contentRun.update({ where: { id: runId }, data: { status: 'running', startedAt: new Date() } });
    try {
      if (!this.provider.isConfigured()) throw new Error('Analysis provider is not configured.');
      if (run.kind === 'topics') {
        await this.processTopics(runId, run);
      } else if (run.kind === 'article') {
        await this.processArticle(runId, run);
      } else {
        throw new Error(`Unknown content run kind: ${run.kind}`);
      }
    } catch (error) {
      this.logger.warn(`Content run ${runId} failed: ${sanitizeError(error)}`);
      await this.prisma.contentRun.update({
        where: { id: runId },
        data: { status: 'failed', finishedAt: new Date(), error: sanitizeError(error) },
      });
    }
  }
}
