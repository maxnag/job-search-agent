import { Module } from '@nestjs/common';

import { MatchProfileRepository } from './repositories/match-profile.repository.js';
import { VacancyMatchRepository } from './repositories/vacancy-match.repository.js';
import { VacancyMatchingService } from './services/vacancy-matching.service.js';

/**
 * The matching code: one rule per file, a verdict with its reasons per vacancy and resume version. No queues — the
 * commands use it too
 */
@Module({
  providers: [MatchProfileRepository, VacancyMatchRepository, VacancyMatchingService],
  exports: [VacancyMatchingService]
})
export class MatchingModule {}
