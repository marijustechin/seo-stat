import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module.js';
import { DatabaseModule } from './database/index.js';
import { HealthModule } from './modules/health/index.js';
import { ProjectsModule } from './modules/projects/index.js';

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule, ProjectsModule],
})
export class AppModule {}
