import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { VacancyMatchVerdictEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import type { IVacancyReportFilter } from '../modules/report/interfaces/vacancy-report-filter.interface.js';
import { VacancyReportService } from '../modules/report/services/vacancy-report.service.js';
import { readCLI } from './helpers/c-l-i-args.helper.js';
import type { ICLIArgs } from './helpers/interfaces/c-l-i-args.interface.js';
import type { ICLISpec } from './helpers/interfaces/c-l-i-spec.interface.js';

/**
 * Options and help of the command
 *
 * @type {ICLISpec}
 */
const SPEC: ICLISpec = {
  command: 'vacancies:report',
  summary:
    'Every position of every source with its stage and why: the reason the code filter dropped it, or its verdict per profile. Filters combine with AND, the values of a repeated option with OR.',
  options: [
    { name: 'source', value: 'id', description: 'Positions of a source', multiple: true, integer: true },
    { name: 'stage', value: 'stage', description: 'Positions at a stage', multiple: true, choices: Object.values(VacancyStageEnum) },
    {
      name: 'verdict',
      value: 'verdict',
      description: 'Positions with a verdict against the current resume of any profile',
      multiple: true,
      choices: Object.values(VacancyMatchVerdictEnum)
    },
    { name: 'reason', value: 'text', description: 'The skip reason or a verdict finding contains the text, case aside' },
    { name: 'country', value: 'code', description: 'Country of the position, ISO code (IL, UA)' },
    { name: 'work-mode', value: 'mode', description: 'Work mode of the position', choices: Object.values(WorkModeEnum) },
    { name: 'title', value: 'text', description: 'The title contains the text, case aside' },
    { name: 'since', value: 'days', description: 'First seen within the last N days', integer: true },
    { name: 'limit', value: 'n', description: 'At most N newest positions per source', integer: true },
    { name: 'closed', description: 'Show the closed positions too — hidden by default' },
    { name: 'summary', description: 'Only the source headers and their counts, no tables' }
  ],
  examples: [
    { args: '--summary', description: 'How many positions each source has, by stage and verdict' },
    { args: '--source 7 --stage skipped', description: 'What the code dropped on one source' },
    { args: '--stage skipped --reason hebrew', description: 'Positions dropped for Hebrew — check none was needed' },
    { args: '--verdict fit --verdict almost --since 7', description: 'Fitting positions of the last week' },
    { args: '--country IL --work-mode hybrid --limit 20', description: 'The 20 newest hybrid positions in Israel per source' }
  ],
  notes: ['Totals count the positions shown. A filter on positions hides the sources left without any.']
};

/**
 * The filter of the report from the checked command line
 *
 * @param {ICLIArgs} args
 *
 * @returns {IVacancyReportFilter}
 */
function reportFilter(args: ICLIArgs): IVacancyReportFilter {
  const { values, flags } = args;
  const sinceDays = values.since?.[0];
  const limit = values.limit?.[0];

  return {
    sourceIds: values.source?.map(id => +id),
    stages: values.stage as readonly VacancyStageEnum[] | undefined,
    verdicts: values.verdict as readonly VacancyMatchVerdictEnum[] | undefined,
    reason: values.reason?.[0],
    country: values.country?.[0],
    workMode: values['work-mode']?.[0] as WorkModeEnum | undefined,
    title: values.title?.[0],
    sinceDays: sinceDays === undefined ? undefined : +sinceDays,
    limit: limit === undefined ? undefined : +limit,
    closed: flags.has('closed')
  };
}

const logger = new Logger('VacanciesReport');
const args = readCLI(SPEC);

if (args) {
  const { CLIModule } = await import('./cli.module.js');
  const app = await NestFactory.createApplicationContext(CLIModule, { logger: ['error', 'warn'] });

  try {
    process.stdout.write(await app.get(VacancyReportService).build(reportFilter(args), args.flags.has('summary')));
  } catch (error) {
    logger.error(error instanceof Error ? error.message : 'Report failed', error instanceof Error ? error.stack : undefined);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
