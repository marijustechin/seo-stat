import { Controller, Get } from '@nestjs/common';
import { AnalysisService } from '../analysis/index.js';
import { ImageService } from '../content/image.service.js';

@Controller('system')
export class SystemController {
  constructor(
    private readonly analysis: AnalysisService,
    private readonly images: ImageService,
  ) {}

  @Get('status')
  status() {
    return { analysis: this.analysis.status(), image: this.images.status() };
  }
}
