import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/index.js';
import { normalizeCompetitorUrls } from './competitor-urls.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectSettingsDto } from './dto/update-project-settings.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { toProjectView, type ProjectRecord } from './project.mapper.js';
import { PROJECT_LIST_FILTERS, type ProjectView } from './project.types.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto): Promise<ProjectView> {
    const name = this.requireName(dto.name);
    this.assertTimezone(dto.timezone);

    const project = await this.prisma.project.create({
      data: {
        name,
        description: this.clean(dto.description),
        websiteUrl: this.clean(dto.websiteUrl),
        businessContext: this.clean(dto.businessContext),
        audience: this.clean(dto.audience),
        objectives: this.clean(dto.objectives),
        contentLanguage: dto.contentLanguage?.trim() || 'en',
        tone: this.clean(dto.tone),
        timezone: dto.timezone?.trim() || 'Europe/Vilnius',
        publishingPolicy: dto.publishingPolicy ?? 'review',
        competitorUrls: normalizeCompetitorUrls(dto.competitorUrls) ?? [],
      },
    });
    return toProjectView(project as ProjectRecord);
  }

  async list(filter?: string): Promise<ProjectView[]> {
    const status = this.parseFilter(filter);
    const projects = await this.prisma.project.findMany({
      where: status === 'all' ? {} : { status },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((project) => toProjectView(project as ProjectRecord));
  }

  async get(id: string): Promise<ProjectView> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} was not found`);
    }
    return toProjectView(project as ProjectRecord);
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectView> {
    await this.get(id);
    const data: {
      name?: string;
      description?: string | null;
      websiteUrl?: string | null;
    } = {};
    if (dto.name !== undefined) data.name = this.requireName(dto.name);
    if (dto.description !== undefined) data.description = this.clean(dto.description);
    if (dto.websiteUrl !== undefined) data.websiteUrl = this.clean(dto.websiteUrl);

    const project = await this.prisma.project.update({ where: { id }, data });
    return toProjectView(project as ProjectRecord);
  }

  async updateSettings(id: string, dto: UpdateProjectSettingsDto): Promise<ProjectView> {
    await this.get(id);
    this.assertTimezone(dto.timezone);

    const data: {
      businessContext?: string | null;
      audience?: string | null;
      objectives?: string | null;
      contentLanguage?: string;
      tone?: string | null;
      timezone?: string;
      publishingPolicy?: string;
      competitorUrls?: string[];
    } = {};
    if (dto.businessContext !== undefined) data.businessContext = this.clean(dto.businessContext);
    if (dto.audience !== undefined) data.audience = this.clean(dto.audience);
    if (dto.objectives !== undefined) data.objectives = this.clean(dto.objectives);
    if (dto.contentLanguage !== undefined) data.contentLanguage = dto.contentLanguage.trim();
    if (dto.tone !== undefined) data.tone = this.clean(dto.tone);
    if (dto.timezone !== undefined) data.timezone = dto.timezone.trim();
    if (dto.publishingPolicy !== undefined) data.publishingPolicy = dto.publishingPolicy;
    if (dto.competitorUrls !== undefined) {
      data.competitorUrls = normalizeCompetitorUrls(dto.competitorUrls) ?? [];
    }

    const project = await this.prisma.project.update({ where: { id }, data });
    return toProjectView(project as ProjectRecord);
  }

  async archive(id: string): Promise<ProjectView> {
    await this.get(id);
    const project = await this.prisma.project.update({
      where: { id },
      data: { status: 'archived', archivedAt: new Date() },
    });
    return toProjectView(project as ProjectRecord);
  }

  async restore(id: string): Promise<ProjectView> {
    await this.get(id);
    const project = await this.prisma.project.update({
      where: { id },
      data: { status: 'active', archivedAt: null },
    });
    return toProjectView(project as ProjectRecord);
  }

  private requireName(value: string | undefined): string {
    const name = (value ?? '').trim();
    if (name.length === 0) {
      throw new BadRequestException('Project name must not be empty');
    }
    return name;
  }

  /** Normalize user text: trim, and treat an empty string as "not set". */
  private clean(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private assertTimezone(timezone: string | undefined): void {
    if (!timezone) return;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone.trim() });
    } catch {
      throw new BadRequestException(`Invalid timezone: ${timezone}`);
    }
  }

  private parseFilter(filter: string | undefined): (typeof PROJECT_LIST_FILTERS)[number] {
    if (filter && (PROJECT_LIST_FILTERS as readonly string[]).includes(filter)) {
      return filter as (typeof PROJECT_LIST_FILTERS)[number];
    }
    return 'active';
  }
}
