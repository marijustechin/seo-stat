import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/index.js';
import { ContentModule } from '../content/content.module.js';
import { SystemController } from './system.controller.js';

@Module({
  imports: [AnalysisModule, ContentModule],
  controllers: [SystemController],
})
export class SystemModule {}
