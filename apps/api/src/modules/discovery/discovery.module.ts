import { Module } from '@nestjs/common';

import { SearchModule } from '../search/search.module.js';
import { VacanciesModule } from '../vacancies/vacancies.module.js';
import { BraveSearchClient } from './clients/brave-search.client.js';
import { SourceCandidateRepository } from './repositories/source-candidate.repository.js';
import { DiscoveryOrchestrator } from './services/discovery.orchestrator.js';
import { SourceCandidateService } from './services/source-candidate.service.js';

/**
 * Discovery of company boards on applicant tracking systems through the Brave Search API — candidates for the owner,
 * never sources by themselves
 */
@Module({
  imports: [SearchModule, VacanciesModule],
  providers: [BraveSearchClient, SourceCandidateRepository, DiscoveryOrchestrator, SourceCandidateService],
  exports: [DiscoveryOrchestrator, SourceCandidateRepository, SourceCandidateService]
})
export class DiscoveryModule {}
