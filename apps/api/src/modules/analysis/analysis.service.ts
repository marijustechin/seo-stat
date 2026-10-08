import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/index.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AnalysisRunner } from './analysis.runner.js';
import { ANALYSIS_LIMITS } from './analysis.limits.js';
import type { AnalysisInputSnapshot, AnalysisRunView, AnalysisStatus } from './analysis.types.js';
import type { AnalysisOutput } from './ai/analysis-schema.js';
import { AnalysisProvider, type ProviderStatus } from './ai/ai-provider.js';
import { ApplySuggestionsDto } from './dto/apply-suggestions.dto.js';

interface AnalysisRunRecord {
  id: string;
  projectId: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  error: string | null;
  appliedAt: Date | null;
  appliedFields: string[];
  inputSnapshot: unknown;
  evidence: unknown;
  result: unknown;
  projectUpdatedAtSnapshot: Date | null;
}

@Injectable()
export class AnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: AnalysisRunner,
    private readonly provider: AnalysisProvider,
  ) {}

  status(): ProviderStatus & { limits: typeof ANALYSIS_LIMITS } {
    return {
      provider: this.provider.providerId,
      model: this.provider.model,
      configured: this.provider.isConfigured(),
      limits: ANALYSIS_LIMITS,
    };
  }

  async start(projectId: string): Promise<AnalysisRunView> {
    const project = await this.requireProject(projectId);
    if (project.status === 'archived') {
      throw new ConflictException('Archived projects cannot be analyzed. Restore the project first.');
    }
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException('Analysis is not configured on the server.');
    }
    const existing = await this.prisma.analysisRun.findFirst({
      where: { projectId, status: { in: ['queued', 'running'] } },
    });
    if (existing) {
      throw new ConflictException('An analysis is already running for this project.');
    }

    const capturedAt = new Date();
    const snapshot: AnalysisInputSnapshot = {
      websiteUrl: project.websiteUrl,
      competitorUrls: project.competitorUrls,
      businessContext: project.businessContext,
      audience: project.audience,
      objectives: project.objectives,
      tone: project.tone,
      contentLanguage: project.contentLanguage,
      projectUpdatedAt: project.updatedAt.toISOString(),
      capturedAt: capturedAt.toISOString(),
    };

    const run = await this.prisma.analysisRun.create({
      data: {
        projectId,
        status: 'queued',
        inputSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        projectUpdatedAtSnapshot: project.updatedAt,
      },
    });
    this.runner.enqueue(run.id);
    return this.toView(run as unknown as AnalysisRunRecord, project.updatedAt);
  }

  async list(projectId: string): Promise<AnalysisRunView[]> {
    const project = await this.requireProject(projectId);
    const runs = await this.prisma.analysisRun.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return runs.map((run) => this.toView(run as unknown as AnalysisRunRecord, project.updatedAt));
  }

  async get(projectId: string, runId: string): Promise<AnalysisRunView> {
    const project = await this.requireProject(projectId);
    const run = await this.prisma.analysisRun.findFirst({ where: { id: runId, projectId } });
    if (!run) {
      throw new NotFoundException(`Analysis ${runId} was not found for this project.`);
    }
    return this.toView(run as unknown as AnalysisRunRecord, project.updatedAt);
  }

  async apply(projectId: string, runId: string, dto: ApplySuggestionsDto): Promise<AnalysisRunView> {
    const project = await this.requireProject(projectId);
    if (project.status === 'archived') {
      throw new ConflictException('Archived projects cannot be updated. Restore the project first.');
    }
    const run = await this.prisma.analysisRun.findFirst({ where: { id: runId, projectId } });
    if (!run) {
      throw new NotFoundException(`Analysis ${runId} was not found for this project.`);
    }
    if (run.status !== 'completed' || !run.result) {
      throw new BadRequestException('Only completed analyses can be applied.');
    }

    const conflict =
      !!run.projectUpdatedAtSnapshot &&
      run.projectUpdatedAtSnapshot.getTime() !== project.updatedAt.getTime();
    if (conflict && !dto.acknowledgeConflict) {
      throw new ConflictException(
        'Project settings changed since this analysis started. Review against current values and confirm to apply.',
      );
    }

    const output = run.result as unknown as AnalysisOutput;
    const data: {
      businessContext?: string | null;
      audience?: string | null;
      objectives?: string | null;
      tone?: string | null;
    } = {};
    const appliedFields: string[] = [];
    if (dto.businessContext) {
      data.businessContext = dto.businessContextValue?.trim() || output.businessContext.value;
      appliedFields.push('businessContext');
    }
    if (dto.audience) {
      data.audience = dto.audienceValue?.trim() || this.audienceSummary(output);
      appliedFields.push('audience');
    }
    if (dto.objectives) {
      data.objectives = dto.objectivesValue?.trim() || output.objectives.value;
      appliedFields.push('objectives');
    }
    if (dto.tone) {
      data.tone = dto.toneValue?.trim() || output.tone.value;
      appliedFields.push('tone');
    }
    if (appliedFields.length === 0) {
      throw new BadRequestException('Select at least one field to apply.');
    }

    // Note: publishingPolicy is intentionally never included here.
    await this.prisma.project.update({ where: { id: projectId }, data });
    const updated = await this.prisma.analysisRun.update({
      where: { id: runId },
      data: { appliedAt: new Date(), appliedFields },
    });
    const refreshed = await this.requireProject(projectId);
    return this.toView(updated as unknown as AnalysisRunRecord, refreshed.updatedAt);
  }

  private audienceSummary(output: AnalysisOutput): string {
    return output.audienceSegments
      .map((segment) => `${segment.name}: ${segment.needs}`)
      .join('\n')
      .slice(0, 4000);
  }

  private async requireProject(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} was not found`);
    }
    return project;
  }

  private toView(run: AnalysisRunRecord, projectUpdatedAt: Date): AnalysisRunView {
    const conflict =
      !!run.projectUpdatedAtSnapshot &&
      run.projectUpdatedAtSnapshot.getTime() !== projectUpdatedAt.getTime();
    return {
      id: run.id,
      projectId: run.projectId,
      status: run.status as AnalysisStatus,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt ? run.startedAt.toISOString() : null,
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      provider: run.provider,
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      estimatedCostUsd: run.estimatedCostUsd,
      error: run.error,
      conflict,
      appliedAt: run.appliedAt ? run.appliedAt.toISOString() : null,
      appliedFields: run.appliedFields,
      inputSnapshot: run.inputSnapshot as AnalysisInputSnapshot,
      evidence: run.evidence ?? null,
      result: run.result ?? null,
    };
  }
}
