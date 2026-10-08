import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/index.js';

export interface HealthStatus {
  status: 'ok' | 'error';
  database: 'up' | 'down';
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up', timestamp };
    } catch {
      // Deliberately do not log or return the underlying error: it can contain
      // connection details. The response only states that the database is down.
      this.logger.warn('Database health check failed.');
      return { status: 'error', database: 'down', timestamp };
    }
  }
}
