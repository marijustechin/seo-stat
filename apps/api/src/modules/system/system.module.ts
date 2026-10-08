import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/index.js';
import { SystemController } from './system.controller.js';

@Module({
  imports: [AnalysisModule],
  controllers: [SystemController],
})
export class SystemModule {}
