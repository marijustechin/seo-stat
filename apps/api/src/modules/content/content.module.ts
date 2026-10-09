import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/index.js';
import { ContentController } from './content.controller.js';
import { ContentRunner } from './content.runner.js';
import { ContentService } from './content.service.js';
import { ImageProvider } from './image.provider.js';
import { OpenAiImageProvider } from './image.openai.provider.js';
import { ImageService } from './image.service.js';

@Module({
  imports: [AnalysisModule],
  controllers: [ContentController],
  providers: [
    ContentService,
    ContentRunner,
    ImageService,
    { provide: ImageProvider, useClass: OpenAiImageProvider },
  ],
  exports: [ContentService, ImageService, ImageProvider],
})
export class ContentModule {}
