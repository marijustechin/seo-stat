import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService, type HealthStatus } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async get(): Promise<HealthStatus> {
    const result = await this.health.check();
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException({
        status: result.status,
        database: result.database,
        timestamp: result.timestamp,
      });
    }
    return result;
  }
}
