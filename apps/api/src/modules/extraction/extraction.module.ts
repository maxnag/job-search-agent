import { Module } from '@nestjs/common';

import { CrawlerModule } from '../crawler/crawler.module.js';
import { LLMModule } from '../llm/l-l-m.module.js';
import { MatchingModule } from '../matching/matching.module.js';
import { SearchModule } from '../search/search.module.js';
import { VacanciesModule } from '../vacancies/vacancies.module.js';
import { ExtractConsumer } from './consumers/extract.consumer.js';
import { VacancyExtractionOrchestrator } from './services/vacancy-extraction.orchestrator.js';
import { VacancyExtractionService } from './services/vacancy-extraction.service.js';

/**
 * Extraction of the vacancies: the `extract` worker, the page text and its hash, the LLM step and the normalization
 */
@Module({
  imports: [CrawlerModule, LLMModule, MatchingModule, SearchModule, VacanciesModule],
  providers: [VacancyExtractionService, VacancyExtractionOrchestrator, ExtractConsumer],
  exports: [VacancyExtractionOrchestrator]
})
export class ExtractionModule {}
