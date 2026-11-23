import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { QueueNameEnum } from '@job-agent/shared';

import { CrawlerModule } from '../crawler/crawler.module.js';
import { LLMModule } from '../llm/l-l-m.module.js';
import { ResumeModule } from '../resume/resume.module.js';
import { VacanciesModule } from '../vacancies/vacancies.module.js';
import { SourceRepository } from './repositories/source.repository.js';
import { ListingExtractionService } from './services/listing-extraction.service.js';
import { ProfilePreferencesService } from './services/profile-preferences.service.js';
import { SourceScanOrchestrator } from './services/source-scan.orchestrator.js';

/**
 * Scans of the career pages: listing extraction, the code filter, the scan itself — no worker, so a command can use it
 */
@Module({
  imports: [CrawlerModule, LLMModule, ResumeModule, VacanciesModule, BullModule.registerQueue({ name: QueueNameEnum.SEARCH })],
  providers: [SourceRepository, ListingExtractionService, ProfilePreferencesService, SourceScanOrchestrator],
  exports: [SourceScanOrchestrator, SourceRepository]
})
export class SearchModule {}
