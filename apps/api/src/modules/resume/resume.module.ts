import { Module, type Type } from '@nestjs/common';

import { LLMModule } from '../llm/l-l-m.module.js';
import type { IResumeParser } from './interfaces/resume-parser.interface.js';
import { PDFResumeParser } from './parsers/p-d-f-resume.parser.js';
import { ProfileRepository } from './repositories/profile.repository.js';
import { ResumeRepository } from './repositories/resume.repository.js';
import { ResumeExtractionService } from './services/resume-extraction.service.js';
import { ResumeImportOrchestrator } from './services/resume-import.orchestrator.js';
import { ResumeParserRegistry } from './services/resume-parser.registry.js';
import { ResumeStorageService } from './services/resume-storage.service.js';

/**
 * Every resume parser; a new format is one class added here — it becomes a provider and joins the registry
 *
 * @type {readonly Type<IResumeParser>[]}
 */
const RESUME_PARSERS: readonly Type<IResumeParser>[] = [PDFResumeParser];

/**
 * Resume import: parsers by extension, LLM extraction, versions per profile
 */
@Module({
  imports: [LLMModule],
  providers: [
    ...RESUME_PARSERS,
    {
      provide: ResumeParserRegistry,
      inject: [...RESUME_PARSERS],
      useFactory: (...parsers: IResumeParser[]) => new ResumeParserRegistry(parsers)
    },
    ResumeExtractionService,
    ResumeStorageService,
    ProfileRepository,
    ResumeRepository,
    ResumeImportOrchestrator
  ],
  exports: [ResumeImportOrchestrator, ProfileRepository]
})
export class ResumeModule {}
