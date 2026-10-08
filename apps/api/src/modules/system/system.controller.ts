import { Controller, Get } from '@nestjs/common';
import { AnalysisService } from '../analysis/index.js';

@Controller('system')
export class SystemController {
  constructor(private readonly analysis: AnalysisService) {}

  @Get('status')
  status() {
    return { analysis: this.analysis.status() };
  }
}
