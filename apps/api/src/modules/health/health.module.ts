import { Module } from '@nestjs/common';

import { LLMModule } from '../llm/l-l-m.module.js';
import { HealthController } from './controllers/health.controller.js';
import { HealthService } from './services/health.service.js';

/**
 * `GET /health`
 */
@Module({
  imports: [LLMModule],
  controllers: [HealthController],
  providers: [HealthService]
})
export class HealthModule {}
