import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ContentService } from './content.service.js';
import { ImageService } from './image.service.js';
import { CreateTopicDto } from './dto/create-topic.dto.js';
import { UpdateBriefDto } from './dto/update-brief.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';
import { UpdateTopicDto } from './dto/update-topic.dto.js';
import { CreateKnowledgeDto, UpdateKnowledgeDto } from './dto/knowledge.dto.js';
import { GenerateImageDto, SelectImageDto, UpdateImageDto, UploadImageDto } from './dto/image.dto.js';
import type { BriefView, ContentRunView, DraftView, ProjectKnowledgeView, TopicView } from './content.types.js';
import type { ArticleImageView } from './image.types.js';

@Controller('projects/:projectId/content')
export class ContentController {
  constructor(
    private readonly content: ContentService,
    private readonly images: ImageService,
  ) {}

  @Post('topics/generate')
  startTopicGeneration(@Param('projectId') projectId: string): Promise<ContentRunView> {
    return this.content.startTopicGeneration(projectId);
  }

  @Get('topics')
  listTopics(@Param('projectId') projectId: string): Promise<TopicView[]> {
    return this.content.listTopics(projectId);
  }

  @Post('topics')
  createTopic(@Param('projectId') projectId: string, @Body() dto: CreateTopicDto): Promise<TopicView> {
    return this.content.createTopic(projectId, dto);
  }

  @Patch('topics/:topicId')
  updateTopic(
    @Param('projectId') projectId: string,
    @Param('topicId') topicId: string,
    @Body() dto: UpdateTopicDto,
  ): Promise<TopicView> {
    return this.content.updateTopic(projectId, topicId, dto);
  }

  @Post('topics/:topicId/dismiss')
  dismissTopic(@Param('projectId') projectId: string, @Param('topicId') topicId: string): Promise<TopicView> {
    return this.content.dismissTopic(projectId, topicId);
  }

  @Get('topics/:topicId/brief')
  getBrief(@Param('projectId') projectId: string, @Param('topicId') topicId: string): Promise<BriefView> {
    return this.content.getBrief(projectId, topicId);
  }

  @Put('topics/:topicId/brief')
  upsertBrief(
    @Param('projectId') projectId: string,
    @Param('topicId') topicId: string,
    @Body() dto: UpdateBriefDto,
  ): Promise<BriefView> {
    return this.content.upsertBrief(projectId, topicId, dto);
  }

  @Post('topics/:topicId/draft')
  startArticleGeneration(
    @Param('projectId') projectId: string,
    @Param('topicId') topicId: string,
  ): Promise<ContentRunView> {
    return this.content.startArticleGeneration(projectId, topicId);
  }

  @Get('drafts')
  listDrafts(@Param('projectId') projectId: string): Promise<DraftView[]> {
    return this.content.listDrafts(projectId);
  }

  @Get('drafts/:draftId')
  getDraft(@Param('projectId') projectId: string, @Param('draftId') draftId: string): Promise<DraftView> {
    return this.content.getDraft(projectId, draftId);
  }

  @Patch('drafts/:draftId')
  updateDraft(
    @Param('projectId') projectId: string,
    @Param('draftId') draftId: string,
    @Body() dto: UpdateDraftDto,
  ): Promise<DraftView> {
    return this.content.updateDraft(projectId, draftId, dto);
  }

  @Post('drafts/:draftId/ready')
  markReady(@Param('projectId') projectId: string, @Param('draftId') draftId: string): Promise<DraftView> {
    return this.content.markReady(projectId, draftId);
  }

  @Get('knowledge')
  listKnowledge(@Param('projectId') projectId: string): Promise<ProjectKnowledgeView[]> {
    return this.content.listKnowledge(projectId);
  }

  @Post('knowledge')
  createKnowledge(@Param('projectId') projectId: string, @Body() dto: CreateKnowledgeDto): Promise<ProjectKnowledgeView> {
    return this.content.createKnowledge(projectId, dto);
  }

  @Patch('knowledge/:knowledgeId')
  updateKnowledge(
    @Param('projectId') projectId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Body() dto: UpdateKnowledgeDto,
  ): Promise<ProjectKnowledgeView> {
    return this.content.updateKnowledge(projectId, knowledgeId, dto);
  }

  @Delete('knowledge/:knowledgeId')
  async deleteKnowledge(@Param('projectId') projectId: string, @Param('knowledgeId') knowledgeId: string): Promise<{ ok: true }> {
    await this.content.deleteKnowledge(projectId, knowledgeId);
    return { ok: true };
  }

  // --- Images -------------------------------------------------------------

  @Get('drafts/:draftId/images')
  listImages(@Param('projectId') projectId: string, @Param('draftId') draftId: string): Promise<ArticleImageView[]> {
    return this.images.list(projectId, draftId);
  }

  @Post('drafts/:draftId/images/generate')
  generateImage(
    @Param('projectId') projectId: string,
    @Param('draftId') draftId: string,
    @Body() dto: GenerateImageDto,
  ): Promise<ArticleImageView> {
    return this.images.generate(projectId, draftId, dto);
  }

  @Post('drafts/:draftId/images/upload')
  uploadImage(
    @Param('projectId') projectId: string,
    @Param('draftId') draftId: string,
    @Body() dto: UploadImageDto,
  ): Promise<ArticleImageView> {
    return this.images.upload(projectId, draftId, dto);
  }

  @Patch('images/:imageId')
  updateImage(
    @Param('projectId') projectId: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateImageDto,
  ): Promise<ArticleImageView> {
    return this.images.update(projectId, imageId, dto);
  }

  @Post('images/:imageId/select')
  selectImage(
    @Param('projectId') projectId: string,
    @Param('imageId') imageId: string,
    @Body() dto: SelectImageDto,
  ): Promise<ArticleImageView> {
    return this.images.select(projectId, imageId, dto);
  }

  @Get('images/:imageId/file')
  async serveImage(
    @Param('projectId') projectId: string,
    @Param('imageId') imageId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const file = await this.images.read(projectId, imageId);
    reply.header('content-type', file.mimeType);
    reply.header('cache-control', 'private, max-age=60');
    reply.header('content-disposition', `inline; filename="${file.fileName}"`);
    await reply.send(file.buffer);
  }

  @Get('runs')
  listRuns(@Param('projectId') projectId: string): Promise<ContentRunView[]> {
    return this.content.listRuns(projectId);
  }

  @Get('runs/:runId')
  getRun(@Param('projectId') projectId: string, @Param('runId') runId: string): Promise<ContentRunView> {
    return this.content.getRun(projectId, runId);
  }
}
