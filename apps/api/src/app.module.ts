import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module.js';
import { DatabaseModule } from './database/index.js';
import { AnalysisModule } from './modules/analysis/index.js';
import { HealthModule } from './modules/health/index.js';
import { ProjectsModule } from './modules/projects/index.js';
import { SystemModule } from './modules/system/system.module.js';

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule, ProjectsModule, AnalysisModule, SystemModule],
})
export class AppModule {}
