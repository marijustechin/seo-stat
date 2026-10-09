import {
  BadRequestException,
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
  ProjectKnowledgeView,
  SourceRef,
  TopicRequirement,
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

function asRequirements(value: Json): TopicRequirement[] {
  return Array.isArray(value) ? (value as unknown as TopicRequirement[]) : [];
}

/** Existing topics stored requirements as free text; keep them readable. */
function requirementsFor(record: { requirements: Json; informationNeeded: string | null }): TopicRequirement[] {
  const stored = asRequirements(record.requirements);
  if (stored.length > 0) return stored;
  if (record.informationNeeded) {
    return [
      {
        id: 'legacy-0',
        question: record.informationNeeded,
        answer: null,
        sourceUrl: null,
        state: 'unanswered',
      },
    ];
  }
  return [];
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
    if (dto.requirements !== undefined) {
      data.requirements = this.normalizeRequirements(dto.requirements) as unknown as Prisma.InputJsonValue;
    }
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
          answers: asRequirements(existing.answers),
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
          answers: requirementsFor(topic),
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
      answers: dto.answers !== undefined ? this.normalizeRequirements(dto.answers) : base.answers,
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
    const topicIds = [...new Set(drafts.map((draft) => draft.topicId))];
    const briefs = await this.prisma.articleBrief.findMany({ where: { projectId, topicId: { in: topicIds } } });
    const byTopic = new Map(briefs.map((brief) => [brief.topicId, brief]));
    return drafts.map((draft) => this.toDraftView(draft, this.isStale(draft, byTopic.get(draft.topicId))));
  }

  async getDraft(projectId: string, draftId: string): Promise<DraftView> {
    await this.requireProject(projectId);
    const draft = await this.requireDraft(projectId, draftId);
    const brief = await this.prisma.articleBrief.findUnique({ where: { topicId: draft.topicId } });
    return this.toDraftView(draft, this.isStale(draft, brief ?? undefined));
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
        answers: asRequirements(brief.answers),
      } satisfies BriefSnapshot,
      research: this.researchSnapshot(project),
      knowledge: (
        await this.prisma.projectKnowledge.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } })
      ).map((note) => note.text),
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

  // --- Project knowledge --------------------------------------------------

  async listKnowledge(projectId: string): Promise<ProjectKnowledgeView[]> {
    await this.requireProject(projectId);
    const items = await this.prisma.projectKnowledge.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => this.toKnowledgeView(item));
  }

  async createKnowledge(projectId: string, dto: { text: string; originQuestion?: string | null; originTopicId?: string | null }): Promise<ProjectKnowledgeView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    const text = (dto.text ?? '').trim().slice(0, 2000);
    if (!text) throw new BadRequestException('Knowledge text is required.');
    const item = await this.prisma.projectKnowledge.create({
      data: {
        projectId,
        text,
        originQuestion: clean(dto.originQuestion),
        originTopicId: clean(dto.originTopicId),
      },
    });
    return this.toKnowledgeView(item);
  }

  async updateKnowledge(projectId: string, knowledgeId: string, dto: { text?: string }): Promise<ProjectKnowledgeView> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    const existing = await this.prisma.projectKnowledge.findFirst({ where: { id: knowledgeId, projectId } });
    if (!existing) throw new NotFoundException('Knowledge note not found for this project.');
    const item = await this.prisma.projectKnowledge.update({
      where: { id: knowledgeId },
      data: { ...(dto.text !== undefined ? { text: dto.text.trim().slice(0, 2000) } : {}) },
    });
    return this.toKnowledgeView(item);
  }

  async deleteKnowledge(projectId: string, knowledgeId: string): Promise<void> {
    const project = await this.requireProject(projectId);
    this.assertActive(project);
    const existing = await this.prisma.projectKnowledge.findFirst({ where: { id: knowledgeId, projectId } });
    if (!existing) throw new NotFoundException('Knowledge note not found for this project.');
    await this.prisma.projectKnowledge.delete({ where: { id: knowledgeId } });
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

  private normalizeRequirements(
    list: Array<{ id?: string; question: string; answer?: string | null; sourceUrl?: string | null; state?: string }>,
  ): TopicRequirement[] {
    return list.slice(0, 10).map((item, index) => ({
      id: item.id && item.id.length > 0 ? item.id : `req-${index}-${Math.random().toString(36).slice(2, 8)}`,
      question: item.question.trim().slice(0, 500),
      answer: clean(item.answer)?.slice(0, 2000) ?? null,
      sourceUrl: clean(item.sourceUrl)?.slice(0, 2048) ?? null,
      state: ['unanswered', 'answered', 'unknown', 'exclude'].includes(item.state ?? '')
        ? (item.state as TopicRequirement['state'])
        : item.answer && item.answer.trim() ? 'answered' : 'unanswered',
    }));
  }

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
      answers: brief.answers as unknown as Prisma.InputJsonValue,
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
        answers: requirementsFor(topic) as unknown as Prisma.InputJsonValue,
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
      requirements: Json;
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
      requirements: requirementsFor(record),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toKnowledgeView(item: Record<string, unknown>): ProjectKnowledgeView {
    const record = item as {
      id: string;
      projectId: string;
      text: string;
      originQuestion: string | null;
      originTopicId: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    return {
      id: record.id,
      projectId: record.projectId,
      text: record.text,
      originQuestion: record.originQuestion,
      originTopicId: record.originTopicId,
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
      answers: Json;
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
      answers: asRequirements(record.answers),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toDraftView(draft: Record<string, unknown>, stale = false): DraftView {
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
      briefSnapshot: Json;
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
      stale,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /** The draft predates changes to the current brief answers. */
  private isStale(draft: { briefSnapshot: Json }, brief: { answers: Json } | undefined): boolean {
    const snapshot = draft.briefSnapshot as { answers?: TopicRequirement[] } | null;
    const snapAnswers = snapshot?.answers ?? [];
    const current = brief ? asRequirements(brief.answers) : [];
    return JSON.stringify(snapAnswers) !== JSON.stringify(current);
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
