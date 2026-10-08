import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectSettingsDto } from './dto/update-project-settings.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { ProjectsService } from './projects.service.js';
import type { ProjectView } from './project.types.js';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@Body() dto: CreateProjectDto): Promise<ProjectView> {
    return this.projects.create(dto);
  }

  @Get()
  list(@Query('status') status?: string): Promise<ProjectView[]> {
    return this.projects.list(status);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<ProjectView> {
    return this.projects.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto): Promise<ProjectView> {
    return this.projects.update(id, dto);
  }

  @Patch(':id/settings')
  updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateProjectSettingsDto,
  ): Promise<ProjectView> {
    return this.projects.updateSettings(id, dto);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string): Promise<ProjectView> {
    return this.projects.archive(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string): Promise<ProjectView> {
    return this.projects.restore(id);
  }
}
