import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/index.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ANALYSIS_LIMITS } from './analysis.limits.js';
import type { AnalysisInputSnapshot } from './analysis.types.js';
import { AnalysisProvider } from './ai/ai-provider.js';
import { analysisJsonSchema, parseAnalysisOutput } from './ai/analysis-schema.js';
import { buildAnalysisPrompt } from './ai/analysis.prompt.js';
import { AnalysisResearch } from './research/research.service.js';

function estimateCost(inputTokens: number, outputTokens: number): number | null {
  const inputPrice = Number.parseFloat(process.env.ANALYSIS_COST_INPUT_PER_MTOK ?? '');
  const outputPrice = Number.parseFloat(process.env.ANALYSIS_COST_OUTPUT_PER_MTOK ?? '');
  if (!Number.isFinite(inputPrice) || !Number.isFinite(outputPrice)) {
    return null;
  }
  return (inputTokens / 1_000_000) * inputPrice + (outputTokens / 1_000_000) * outputPrice;
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/\s+/g, ' ').slice(0, 300);
  }
  return 'Analysis failed.';
}

/**
 * Smallest reliable asynchronous execution: an in-process queue started from
 * the API request. The run row is persisted before enqueuing. Any run left
 * queued/running by a restart is marked interrupted on startup and can be
 * retried manually.
 */
@Injectable()
export class AnalysisRunner implements OnModuleInit {
  private readonly logger = new Logger(AnalysisRunner.name);
  private readonly queue: string[] = [];
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AnalysisProvider,
    private readonly research: AnalysisResearch,
  ) {}

  async onModuleInit(): Promise<void> {
    const result = await this.prisma.analysisRun.updateMany({
      where: { status: { in: ['queued', 'running'] } },
      data: {
        status: 'interrupted',
        finishedAt: new Date(),
        error: 'Interrupted by a service restart. Start a new analysis to retry.',
      },
    });
    if (result.count > 0) {
      this.logger.warn(`Marked ${result.count} interrupted analysis run(s).`);
    }
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

  private async process(runId: string): Promise<void> {
    const run = await this.prisma.analysisRun.findUnique({ where: { id: runId } });
    if (!run || run.status !== 'queued') return;

    await this.prisma.analysisRun.update({
      where: { id: runId },
      data: { status: 'running', startedAt: new Date() },
    });

    const snapshot = run.inputSnapshot as unknown as AnalysisInputSnapshot;
    try {
      if (!this.provider.isConfigured()) {
        throw new Error('Analysis provider is not configured.');
      }
      const research = await this.research.collect(snapshot);
      const { system, user } = buildAnalysisPrompt(snapshot, research);
      const modelResult = await this.provider.analyze({
        system,
        user,
        schemaName: 'project_analysis',
        jsonSchema: analysisJsonSchema(),
        maxOutputTokens: ANALYSIS_LIMITS.maxOutputTokens,
      });
      const output = parseAnalysisOutput(modelResult.output);
      await this.prisma.analysisRun.update({
        where: { id: runId },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          provider: this.provider.providerId,
          model: this.provider.model,
          inputTokens: modelResult.inputTokens,
          outputTokens: modelResult.outputTokens,
          estimatedCostUsd: estimateCost(modelResult.inputTokens, modelResult.outputTokens),
          evidence: {
            backend: research.backend,
            firecrawlCredits: research.firecrawlCredits,
            pages: research.pages,
            failures: research.failures,
            websiteReadable: research.websiteReadable,
          } as unknown as Prisma.InputJsonValue,
          result: output as unknown as Prisma.InputJsonValue,
          error: null,
        },
      });
    } catch (error) {
      this.logger.warn(`Analysis run ${runId} failed: ${sanitizeError(error)}`);
      await this.prisma.analysisRun.update({
        where: { id: runId },
        data: { status: 'failed', finishedAt: new Date(), error: sanitizeError(error) },
      });
    }
  }
}
