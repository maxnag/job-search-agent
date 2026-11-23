import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import { VacancyMatchingService } from '../modules/matching/services/vacancy-matching.service.js';
import { paint, paintVerdict } from '../modules/report/helpers/terminal-style.helper.js';
import { formatResumeSummary } from '../modules/resume/helpers/resume-summary.helper.js';
import { ResumeImportOrchestrator } from '../modules/resume/services/resume-import.orchestrator.js';
import { CLIModule } from './cli.module.js';

const USAGE = 'Usage: pnpm cv:import <resume file> --profile <name>\n';
const logger = new Logger('CVImport');
const { values, positionals } = parseArgs({ allowPositionals: true, options: { profile: { type: 'string' } } });
const [file] = positionals;

if (!file || !values.profile) {
  process.stderr.write(USAGE);
  process.exitCode = 1;
} else {
  const app = await NestFactory.createApplicationContext(CLIModule, { logger: ['error', 'warn', 'log', 'debug'] });

  try {
    const result = await app.get(ResumeImportOrchestrator).processImport({ filePath: resolve(file), profileName: values.profile });

    process.stdout.write(formatResumeSummary(result));

    const matched = await app.get(VacancyMatchingService).matchProfile(result.profileId);

    const counts = Object.values(VacancyMatchVerdictEnum).map(verdict => paintVerdict(verdict, `${verdict} ${matched.verdicts[verdict]}`));
    const heading = paint('bold', 'Vacancies matched against the current resume:');
    const notifiable = paint('cyan', `${matched.notifiableMatchIds.length} new to be sent to Telegram`);

    process.stdout.write(`\n${heading} ${counts.join(', ')}; ${notifiable}\n`);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : 'Import failed', error instanceof Error ? error.stack : undefined);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
