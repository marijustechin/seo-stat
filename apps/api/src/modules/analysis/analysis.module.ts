import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller.js';
import { AnalysisRunner } from './analysis.runner.js';
import { AnalysisService } from './analysis.service.js';
import { AnalysisProvider } from './ai/ai-provider.js';
import { DeepSeekAnalysisProvider } from './ai/deepseek.provider.js';
import { FirecrawlResearchService } from './research/firecrawl.research.js';
import { AnalysisResearch } from './research/research.port.js';
import { ResearchCoordinator, SiteResearchService } from './research/research.service.js';

@Module({
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    AnalysisRunner,
    { provide: AnalysisProvider, useClass: DeepSeekAnalysisProvider },
    SiteResearchService,
    FirecrawlResearchService,
    ResearchCoordinator,
    { provide: AnalysisResearch, useExisting: ResearchCoordinator },
  ],
  exports: [AnalysisService, AnalysisProvider, AnalysisResearch, ResearchCoordinator],
})
export class AnalysisModule {}
