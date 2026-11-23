import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import type { IHealthReport, IHealthStatus } from '../interfaces/health-report.interface.js';
import { HealthService } from '../services/health.service.js';

/**
 * Liveness of the application and its dependencies
 */
@Controller('health')
export class HealthController {
  /**
   * @param {HealthService} healthService
   */
  constructor(private readonly healthService: HealthService) {}

  /**
   * Status and version (production) or every dependency (development, test); 503 when Postgres or Redis is down
   *
   * @throws {ServiceUnavailableException} If Postgres or Redis is down
   *
   * @returns {Promise<IHealthStatus | IHealthReport>}
   */
  @Get()
  async check(): Promise<IHealthStatus | IHealthReport> {
    const report = await this.healthService.check();

    if (report.status === 'error') {
      throw new ServiceUnavailableException(report);
    }

    return report;
  }
}
