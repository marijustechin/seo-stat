import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller.js';
import { AnalysisRunner } from './analysis.runner.js';
import { AnalysisService } from './analysis.service.js';
import { AnalysisProvider } from './ai/ai-provider.js';
import { DeepSeekAnalysisProvider } from './ai/deepseek.provider.js';
import { AnalysisResearch, SiteResearchService } from './research/research.service.js';

@Module({
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    AnalysisRunner,
    { provide: AnalysisProvider, useClass: DeepSeekAnalysisProvider },
    { provide: AnalysisResearch, useClass: SiteResearchService },
  ],
  exports: [AnalysisService, AnalysisProvider, AnalysisResearch],
})
export class AnalysisModule {}
