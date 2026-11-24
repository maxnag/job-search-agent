import { resolve } from 'node:path';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import { VacancyMatchingService } from '../modules/matching/services/vacancy-matching.service.js';
import { paint, paintVerdict } from '../modules/report/helpers/terminal-style.helper.js';
import { formatResumeSummary } from '../modules/resume/helpers/resume-summary.helper.js';
import { ResumeImportOrchestrator } from '../modules/resume/services/resume-import.orchestrator.js';
import { readCLI } from './helpers/c-l-i-args.helper.js';
import type { ICLISpec } from './helpers/interfaces/c-l-i-spec.interface.js';

/**
 * Arguments, options and help of the command
 *
 * @type {ICLISpec}
 */
const SPEC: ICLISpec = {
  command: 'cv:import',
  summary: 'Turn a resume into a new version of a profile, print the profile and match every vacancy against it again.',
  arguments: [{ name: 'file', description: 'Resume file (PDF)', required: true }],
  options: [{ name: 'profile', value: 'name', description: 'Profile the resume belongs to — created on its first import', required: true }],
  examples: [{ args: '~/cv/developer.pdf --profile developer', description: 'Import a resume into the developer profile' }],
  notes: [
    'A file the profile already has is not read again: an older version of it becomes current once more.',
    'A resume is read by the LLM of LLM_PROVIDER — Ollama has to be running for LLM_PROVIDER=ollama.'
  ]
};

const logger = new Logger('CVImport');
const args = readCLI(SPEC);
const [file] = args?.positionals ?? [];
const profile = args?.values.profile?.[0];

if (file !== undefined && profile !== undefined) {
  const { CLIModule } = await import('./cli.module.js');
  const app = await NestFactory.createApplicationContext(CLIModule, { logger: ['error', 'warn', 'log', 'debug'] });

  try {
    const result = await app.get(ResumeImportOrchestrator).processImport({ filePath: resolve(file), profileName: profile });

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
