import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/index.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AnalysisProvider } from '../analysis/ai/ai-provider.js';
import type { AnalysisInputSnapshot } from '../analysis/analysis.types.js';
import { ContentRunner } from './content.runner.js';
import { CreateTopicDto } from './dto/create-topic.dto.js';
import { UpdateBriefDto } from './dto/update-brief.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';
import { UpdateTopicDto } from './dto/update-topic.dto.js';
import type {
  BriefSnapshot,
  BriefView,
  ContentRunKind,
  ContentRunView,
  ContentSettingsSnapshot,
  DraftView,
  SourceRef,
  TopicStatus,
  TopicView,
} from './content.types.js';

type Json = Prisma.JsonValue;

function asSources(value: Json): SourceRef[] {
  return Array.isArray(value) ? (value as unknown as SourceRef[]) : [];
}

function asStrings(value: Json): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

function clean(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: ContentRunner,
    private readonly provider: AnalysisProvider,
  ) {}

  // --- Topics -------------------------------------------------------------

  async listTopics(projectId: string): Promise<TopicView[]> {
    await this.requireProject(projectId);
    const topics = await this.prisma.contentTopic.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return topics.map((topic) => this.toTopicView(topic));
  }

  async createTopic(projectId: string, dto: CreateTopicDto): Promise<TopicView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    const topic = await this.prisma.contentTopic.create({
      data: {
        projectId,
        title: dto.title.trim(),
        audience: dto.audience.trim(),
        objective: dto.objective.trim(),
        angle: dto.angle.trim(),
        readerNeed: clean(dto.readerNeed),
        callToAction: clean(dto.callToAction),
        relevance: clean(dto.relevance),
        informationNeeded: clean(dto.informationNeeded),
        objectiveAlignment: clean(dto.objectiveAlignment),
        priority: dto.priority ?? 'supporting',
        origin: 'manual',
      },
    });
    return this.toTopicView(topic);
  }

  async updateTopic(projectId: string, topicId: string, dto: UpdateTopicDto): Promise<TopicView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    await this.requireTopic(projectId, topicId);
    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.audience !== undefined) data.audience = dto.audience.trim();
    if (dto.objective !== undefined) data.objective = dto.objective.trim();
    if (dto.angle !== undefined) data.angle = dto.angle.trim();
    if (dto.readerNeed !== undefined) data.readerNeed = clean(dto.readerNeed);
    if (dto.callToAction !== undefined) data.callToAction = clean(dto.callToAction);
    if (dto.relevance !== undefined) data.relevance = clean(dto.relevance);
    if (dto.informationNeeded !== undefined) data.informationNeeded = clean(dto.informationNeeded);
    if (dto.objectiveAlignment !== undefined) data.objectiveAlignment = clean(dto.objectiveAlignment);
    if (dto.priority !== undefined) data.priority = dto.priority;
    const topic = await this.prisma.contentTopic.update({ where: { id: topicId }, data });
    return this.toTopicView(topic);
  }

  async dismissTopic(projectId: string, topicId: string): Promise<TopicView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    await this.requireTopic(projectId, topicId);
    const topic = await this.prisma.contentTopic.update({ where: { id: topicId }, data: { status: 'dismissed' } });
    return this.toTopicView(topic);
  }

  async startTopicGeneration(projectId: string): Promise<ContentRunView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    this.assertProvider();
    const existing = await this.prisma.contentRun.findFirst({
      where: { projectId, kind: 'topics', status: { in: ['queued', 'running'] } },
    });
    if (existing) throw new ConflictException('Topic generation is already running for this project.');
    const snapshot = this.settingsSnapshot(project);
    const run = await this.prisma.contentRun.create({
      data: { projectId, kind: 'topics', status: 'queued', inputSnapshot: snapshot as unknown as Prisma.InputJsonValue },
    });
    this.runner.enqueue(run.id);
    return this.toRunView(run);
  }

  // --- Brief --------------------------------------------------------------

  async getBrief(projectId: string, topicId: string): Promise<BriefView> {
    await this.requireProject(projectId);
    await this.requireTopic(projectId, topicId);
    const brief = await this.prisma.articleBrief.findUnique({ where: { topicId } });
    if (!brief) throw new NotFoundException('No brief exists for this topic yet.');
    return this.toBriefView(brief);
  }

  async upsertBrief(projectId: string, topicId: string, dto: UpdateBriefDto): Promise<BriefView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    const topic = await this.requireTopic(projectId, topicId);
    const existing = await this.prisma.articleBrief.findUnique({ where: { topicId } });
    const base: BriefSnapshot = existing
      ? {
          title: existing.title,
          angle: existing.angle,
          audience: existing.audience,
          businessOutcome: existing.businessOutcome,
          outline: existing.outline,
          callToAction: existing.callToAction,
          destinationUrl: existing.destinationUrl,
          sources: asSources(existing.sources),
          confirmations: asStrings(existing.confirmations),
        }
      : {
          title: topic.title,
          angle: topic.angle,
          audience: topic.audience,
          businessOutcome: topic.objective,
          outline: '',
          callToAction: topic.callToAction,
          destinationUrl: null,
          sources: asSources(topic.sources),
          confirmations: topic.informationNeeded ? [topic.informationNeeded] : [],
        };
    const merged: BriefSnapshot = {
      title: dto.title !== undefined ? dto.title : base.title,
      angle: dto.angle !== undefined ? dto.angle : base.angle,
      audience: dto.audience !== undefined ? dto.audience : base.audience,
      businessOutcome: dto.businessOutcome !== undefined ? clean(dto.businessOutcome) : base.businessOutcome,
      outline: dto.outline !== undefined ? clean(dto.outline) : base.outline,
      callToAction: dto.callToAction !== undefined ? clean(dto.callToAction) : base.callToAction,
      destinationUrl: dto.destinationUrl !== undefined ? clean(dto.destinationUrl) : base.destinationUrl,
      sources: dto.sources !== undefined ? dto.sources : base.sources,
      confirmations: dto.confirmations !== undefined ? dto.confirmations : base.confirmations,
    };
    const brief = await this.prisma.articleBrief.upsert({
      where: { topicId },
      create: {
        projectId,
        topicId,
        ...this.briefData(merged),
        settingsSnapshot: this.settingsSnapshot(project) as unknown as Prisma.InputJsonValue,
      },
      update: { ...this.briefData(merged), settingsSnapshot: this.settingsSnapshot(project) as unknown as Prisma.InputJsonValue },
    });
    return this.toBriefView(brief);
  }

  // --- Drafts -------------------------------------------------------------

  async listDrafts(projectId: string): Promise<DraftView[]> {
    await this.requireProject(projectId);
    const drafts = await this.prisma.articleDraft.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
    return drafts.map((draft) => this.toDraftView(draft));
  }

  async getDraft(projectId: string, draftId: string): Promise<DraftView> {
    await this.requireProject(projectId);
    return this.toDraftView(await this.requireDraft(projectId, draftId));
  }

  async updateDraft(projectId: string, draftId: string, dto: UpdateDraftDto): Promise<DraftView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    const draft = await this.requireDraft(projectId, draftId);
    if (dto.expectedUpdatedAt && dto.expectedUpdatedAt !== draft.updatedAt.toISOString()) {
      throw new ConflictException('This draft was changed since you loaded it. Reload before saving.');
    }
    const data: Record<string, unknown> = { savedAt: new Date() };
    if (dto.title !== undefined) data.title = clean(dto.title);
    if (dto.excerpt !== undefined) data.excerpt = clean(dto.excerpt);
    if (dto.bodyMarkdown !== undefined) data.bodyMarkdown = dto.bodyMarkdown;
    if (dto.slug !== undefined) data.slug = clean(dto.slug);
    if (dto.seoTitle !== undefined) data.seoTitle = clean(dto.seoTitle);
    if (dto.metaDescription !== undefined) data.metaDescription = clean(dto.metaDescription);
    if (dto.callToAction !== undefined) data.callToAction = clean(dto.callToAction);
    if (dto.unresolvedClaims !== undefined) data.unresolvedClaims = dto.unresolvedClaims as unknown as Prisma.InputJsonValue;
    const updated = await this.prisma.articleDraft.update({ where: { id: draftId }, data });
    return this.toDraftView(updated);
  }

  async markReady(projectId: string, draftId: string): Promise<DraftView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    await this.requireDraft(projectId, draftId);
    const draft = await this.prisma.articleDraft.update({
      where: { id: draftId },
      data: { status: 'ready_for_review', savedAt: new Date() },
    });
    return this.toDraftView(draft);
  }

  async startArticleGeneration(projectId: string, topicId: string): Promise<ContentRunView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    this.assertProvider();
    await this.requireTopic(projectId, topicId);
    await this.ensureBrief(project, topicId);
    const brief = await this.prisma.articleBrief.findUnique({ where: { topicId } });
    if (!brief) throw new NotFoundException('Brief could not be prepared.');
    const existing = await this.prisma.contentRun.findFirst({
      where: { projectId, kind: 'article', topicId, status: { in: ['queued', 'running'] } },
    });
    if (existing) throw new ConflictException('Article generation is already running for this topic.');

    const snapshot = {
      settings: this.settingsSnapshot(project),
      brief: {
        title: brief.title,
        angle: brief.angle,
        audience: brief.audience,
        businessOutcome: brief.businessOutcome,
        outline: brief.outline,
        callToAction: brief.callToAction,
        destinationUrl: brief.destinationUrl,
        sources: asSources(brief.sources),
        confirmations: asStrings(brief.confirmations),
      } satisfies BriefSnapshot,
      research: this.researchSnapshot(project),
    };
    const run = await this.prisma.contentRun.create({
      data: {
        projectId,
        kind: 'article',
        topicId,
        status: 'queued',
        inputSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    this.runner.enqueue(run.id);
    return this.toRunView(run);
  }

  // --- Runs ---------------------------------------------------------------

  async listRuns(projectId: string): Promise<ContentRunView[]> {
    await this.requireProject(projectId);
    const runs = await this.prisma.contentRun.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
    return runs.map((run) => this.toRunView(run));
  }

  async getRun(projectId: string, runId: string): Promise<ContentRunView> {
    await this.requireProject(projectId);
    const run = await this.prisma.contentRun.findFirst({ where: { id: runId, projectId } });
    if (!run) throw new NotFoundException('Content run not found.');
    return this.toRunView(run);
  }

  // --- Helpers ------------------------------------------------------------

  private briefData(brief: BriefSnapshot) {
    return {
      title: brief.title,
      angle: brief.angle,
      audience: brief.audience,
      businessOutcome: brief.businessOutcome,
      outline: brief.outline,
      callToAction: brief.callToAction,
      destinationUrl: brief.destinationUrl,
      sources: brief.sources as unknown as Prisma.InputJsonValue,
      confirmations: brief.confirmations as unknown as Prisma.InputJsonValue,
    };
  }

  private async ensureBrief(
    project: {
      id: string;
      websiteUrl: string | null;
      businessContext: string | null;
      audience: string | null;
      objectives: string | null;
      contentLanguage: string;
      tone: string | null;
    },
    topicId: string,
  ) {
    const existing = await this.prisma.articleBrief.findUnique({ where: { topicId } });
    if (existing) return;
    const topic = await this.prisma.contentTopic.findUnique({ where: { id: topicId } });
    if (!topic) return;
    await this.prisma.articleBrief.create({
      data: {
        projectId: project.id,
        topicId,
        title: topic.title,
        angle: topic.angle,
        audience: topic.audience,
        businessOutcome: topic.objective,
        outline: '',
        callToAction: topic.callToAction,
        sources: topic.sources as unknown as Prisma.InputJsonValue,
        confirmations: (topic.informationNeeded ? [topic.informationNeeded] : []) as unknown as Prisma.InputJsonValue,
        settingsSnapshot: this.settingsSnapshot(project) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private assertProvider() {
    if (!this.provider.isConfigured()) {
      throw new ServiceUnavailableException('AI provider is not configured on the server.');
    }
  }

  private assertActive(project: { status: string }) {
    if (project.status === 'archived') {
      throw new ConflictException('Archived projects cannot generate or edit content. Restore the project first.');
    }
  }

  private async requireProject(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} was not found`);
    return project;
  }

  private async requireTopic(projectId: string, topicId: string) {
    const topic = await this.prisma.contentTopic.findFirst({ where: { id: topicId, projectId } });
    if (!topic) throw new NotFoundException('Topic not found for this project.');
    return topic;
  }

  private async requireDraft(projectId: string, draftId: string) {
    const draft = await this.prisma.articleDraft.findFirst({ where: { id: draftId, projectId } });
    if (!draft) throw new NotFoundException('Draft not found for this project.');
    return draft;
  }

  private settingsSnapshot(project: {
    websiteUrl: string | null;
    businessContext: string | null;
    audience: string | null;
    objectives: string | null;
    contentLanguage: string;
    tone: string | null;
  }): ContentSettingsSnapshot {
    return {
      websiteUrl: project.websiteUrl,
      businessContext: project.businessContext,
      audience: project.audience,
      objectives: project.objectives,
      contentLanguage: project.contentLanguage,
      tone: project.tone,
      capturedAt: new Date().toISOString(),
    };
  }

  private researchSnapshot(project: {
    websiteUrl: string | null;
    competitorUrls: string[];
    businessContext: string | null;
    audience: string | null;
    objectives: string | null;
    tone: string | null;
    contentLanguage: string;
    updatedAt: Date;
  }): AnalysisInputSnapshot {
    return {
      websiteUrl: project.websiteUrl,
      competitorUrls: project.competitorUrls,
      businessContext: project.businessContext,
      audience: project.audience,
      objectives: project.objectives,
      tone: project.tone,
      contentLanguage: project.contentLanguage,
      projectUpdatedAt: project.updatedAt.toISOString(),
      capturedAt: new Date().toISOString(),
    };
  }

  private toTopicView(topic: Record<string, unknown>): TopicView {
    const record = topic as {
      id: string;
      projectId: string;
      title: string;
      audience: string;
      objective: string;
      readerNeed: string | null;
      angle: string;
      callToAction: string | null;
      relevance: string | null;
      informationNeeded: string | null;
      objectiveAlignment: string | null;
      priority: string;
      origin: string;
      status: string;
      sources: Json;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: record.id,
      projectId: record.projectId,
      title: record.title,
      audience: record.audience,
      objective: record.objective,
      readerNeed: record.readerNeed,
      angle: record.angle,
      callToAction: record.callToAction,
      relevance: record.relevance,
      informationNeeded: record.informationNeeded,
      objectiveAlignment: record.objectiveAlignment,
      priority: record.priority as TopicView['priority'],
      origin: record.origin,
      status: record.status as TopicStatus,
      sources: asSources(record.sources),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toBriefView(brief: Record<string, unknown>): BriefView {
    const record = brief as {
      id: string;
      projectId: string;
      topicId: string;
      title: string;
      angle: string;
      audience: string;
      businessOutcome: string | null;
      outline: string | null;
      callToAction: string | null;
      destinationUrl: string | null;
      sources: Json;
      confirmations: Json;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: record.id,
      projectId: record.projectId,
      topicId: record.topicId,
      title: record.title,
      angle: record.angle,
      audience: record.audience,
      businessOutcome: record.businessOutcome,
      outline: record.outline,
      callToAction: record.callToAction,
      destinationUrl: record.destinationUrl,
      sources: asSources(record.sources),
      confirmations: asStrings(record.confirmations),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toDraftView(draft: Record<string, unknown>): DraftView {
    const record = draft as {
      id: string;
      projectId: string;
      topicId: string;
      briefId: string | null;
      version: number;
      status: string;
      title: string | null;
      excerpt: string | null;
      bodyMarkdown: string;
      slug: string | null;
      seoTitle: string | null;
      metaDescription: string | null;
      callToAction: string | null;
      sources: Json;
      unresolvedClaims: Json;
      generationRunId: string | null;
      savedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: record.id,
      projectId: record.projectId,
      topicId: record.topicId,
      briefId: record.briefId,
      version: record.version,
      status: record.status as 'draft' | 'ready_for_review',
      title: record.title,
      excerpt: record.excerpt,
      bodyMarkdown: record.bodyMarkdown,
      slug: record.slug,
      seoTitle: record.seoTitle,
      metaDescription: record.metaDescription,
      callToAction: record.callToAction,
      sources: asSources(record.sources),
      unresolvedClaims: asStrings(record.unresolvedClaims),
      generationRunId: record.generationRunId,
      savedAt: record.savedAt ? record.savedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toRunView(run: Record<string, unknown>): ContentRunView {
    const record = run as {
      id: string;
      projectId: string;
      kind: string;
      topicId: string | null;
      draftId: string | null;
      status: string;
      inputSnapshot: Json;
      evidence: Json;
      result: Json;
      error: string | null;
      provider: string | null;
      model: string | null;
      inputTokens: number | null;
      outputTokens: number | null;
      estimatedCostUsd: number | null;
      startedAt: Date | null;
      finishedAt: Date | null;
      createdAt: Date;
    };
    return {
      id: record.id,
      projectId: record.projectId,
      kind: record.kind as ContentRunKind,
      topicId: record.topicId,
      draftId: record.draftId,
      status: record.status as ContentRunView['status'],
      inputSnapshot: record.inputSnapshot,
      evidence: record.evidence ?? null,
      result: record.result ?? null,
      error: record.error,
      provider: record.provider,
      model: record.model,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      estimatedCostUsd: record.estimatedCostUsd,
      startedAt: record.startedAt ? record.startedAt.toISOString() : null,
      finishedAt: record.finishedAt ? record.finishedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
