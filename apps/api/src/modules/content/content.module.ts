import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/index.js';
import { ContentController } from './content.controller.js';
import { ContentRunner } from './content.runner.js';
import { ContentService } from './content.service.js';

@Module({
  imports: [AnalysisModule],
  controllers: [ContentController],
  providers: [ContentService, ContentRunner],
})
export class ContentModule {}
