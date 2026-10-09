import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ContentService } from './content.service.js';
import { CreateTopicDto } from './dto/create-topic.dto.js';
import { UpdateBriefDto } from './dto/update-brief.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';
import { UpdateTopicDto } from './dto/update-topic.dto.js';
import type { BriefView, ContentRunView, DraftView, TopicView } from './content.types.js';

@Controller('projects/:projectId/content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

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

  @Get('runs')
  listRuns(@Param('projectId') projectId: string): Promise<ContentRunView[]> {
    return this.content.listRuns(projectId);
  }

  @Get('runs/:runId')
  getRun(@Param('projectId') projectId: string, @Param('runId') runId: string): Promise<ContentRunView> {
    return this.content.getRun(projectId, runId);
  }
}
