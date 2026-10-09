import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { SaveWordpressIntegrationDto } from './dto/wordpress.dto.js';
import { WordpressService } from './wordpress.service.js';
import type { WordpressIntegrationView } from './wordpress.types.js';

@Controller('projects/:projectId/integrations/wordpress')
export class WordpressIntegrationController {
  constructor(private readonly wordpress: WordpressService) {}

  @Get()
  get(@Param('projectId') projectId: string): Promise<WordpressIntegrationView> {
    return this.wordpress.getIntegration(projectId);
  }

  @Put()
  save(
    @Param('projectId') projectId: string,
    @Body() dto: SaveWordpressIntegrationDto,
  ): Promise<WordpressIntegrationView> {
    return this.wordpress.saveIntegration(projectId, dto);
  }

  @Post('test')
  test(@Param('projectId') projectId: string): Promise<WordpressIntegrationView> {
    return this.wordpress.testIntegration(projectId);
  }

  @Delete()
  disconnect(@Param('projectId') projectId: string): Promise<WordpressIntegrationView> {
    return this.wordpress.disconnect(projectId);
  }
}
