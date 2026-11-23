import { Module } from '@nestjs/common';

import { createConfigModule } from '../config/config-module.factory.js';
import { DatabaseModule } from '../modules/database/database.module.js';
import { MatchingModule } from '../modules/matching/matching.module.js';
import { ReportModule } from '../modules/report/report.module.js';
import { ResumeModule } from '../modules/resume/resume.module.js';

/**
 * Root module of the commands: configuration, database and the modules a command uses — no HTTP, no queues
 */
@Module({
  imports: [createConfigModule(), DatabaseModule, ResumeModule, MatchingModule, ReportModule]
})
export class CLIModule {}
