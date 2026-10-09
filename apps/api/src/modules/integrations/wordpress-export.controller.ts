import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ExportWordpressDraftDto } from './dto/wordpress.dto.js';
import { WordpressService } from './wordpress.service.js';
import type { DraftExportView } from './wordpress.types.js';

@Controller('projects/:projectId/content/drafts/:draftId/wordpress')
export class WordpressExportController {
  constructor(private readonly wordpress: WordpressService) {}

  @Get()
  state(@Param('projectId') projectId: string, @Param('draftId') draftId: string): Promise<DraftExportView> {
    return this.wordpress.getExportState(projectId, draftId);
  }

  @Post('export')
  export(
    @Param('projectId') projectId: string,
    @Param('draftId') draftId: string,
    @Body() dto: ExportWordpressDraftDto,
  ): Promise<DraftExportView> {
    return this.wordpress.exportDraft(projectId, draftId, dto);
  }

  @Post('reconcile')
  reconcile(@Param('projectId') projectId: string, @Param('draftId') draftId: string): Promise<DraftExportView> {
    return this.wordpress.reconcile(projectId, draftId);
  }
}
