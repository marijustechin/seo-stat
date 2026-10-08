import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AnalysisService } from './analysis.service.js';
import { ApplySuggestionsDto } from './dto/apply-suggestions.dto.js';
import type { AnalysisRunView } from './analysis.types.js';

@Controller('projects/:projectId/analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Post()
  start(@Param('projectId') projectId: string): Promise<AnalysisRunView> {
    return this.analysis.start(projectId);
  }

  @Get()
  list(@Param('projectId') projectId: string): Promise<AnalysisRunView[]> {
    return this.analysis.list(projectId);
  }

  @Get(':runId')
  get(@Param('projectId') projectId: string, @Param('runId') runId: string): Promise<AnalysisRunView> {
    return this.analysis.get(projectId, runId);
  }

  @Post(':runId/apply')
  apply(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Body() dto: ApplySuggestionsDto,
  ): Promise<AnalysisRunView> {
    return this.analysis.apply(projectId, runId, dto);
  }
}
