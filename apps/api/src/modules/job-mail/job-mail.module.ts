import { Module } from '@nestjs/common';

import { LLMModule } from '../llm/l-l-m.module.js';
import { SearchModule } from '../search/search.module.js';
import { VacanciesModule } from '../vacancies/vacancies.module.js';
import type { IJobMailProvider } from './interfaces/job-mail-provider.interface.js';
import { IMAPJobMailProvider } from './providers/i-m-a-p-job-mail.provider.js';
import { JobMailMessageRepository } from './repositories/job-mail-message.repository.js';
import { JobMailProviderRegistry } from './services/job-mail-provider.registry.js';
import { JobMailReadOrchestrator } from './services/job-mail-read.orchestrator.js';
import { JobMailTriageService } from './services/job-mail-triage.service.js';

/**
 * Job alerts from the mailbox: the adapter of `JOB_MAIL_PROVIDER` reads it, the LLM tells the kind of each e-mail by
 * its headers, the links of a job alert become vacancies like the links of a listing — no worker, so a command can use it
 */
@Module({
  imports: [LLMModule, SearchModule, VacanciesModule],
  providers: [
    IMAPJobMailProvider,
    {
      provide: JobMailProviderRegistry,
      inject: [IMAPJobMailProvider],
      useFactory: (...providers: IJobMailProvider[]) => new JobMailProviderRegistry(providers)
    },
    JobMailMessageRepository,
    JobMailTriageService,
    JobMailReadOrchestrator
  ],
  exports: [JobMailReadOrchestrator]
})
export class JobMailModule {}
