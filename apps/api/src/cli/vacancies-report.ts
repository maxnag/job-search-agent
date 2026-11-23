import { parseArgs } from 'node:util';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { VacancyReportService } from '../modules/report/services/vacancy-report.service.js';
import { CLIModule } from './cli.module.js';

const USAGE = 'Usage: pnpm vacancies:report [--source <id>]\n';
const logger = new Logger('VacanciesReport');
const { values } = parseArgs({ options: { source: { type: 'string' } } });
const sourceId = values.source === undefined ? undefined : +values.source;

if (sourceId !== undefined && !Number.isInteger(sourceId)) {
  process.stderr.write(USAGE);
  process.exitCode = 1;
} else {
  const app = await NestFactory.createApplicationContext(CLIModule, { logger: ['error', 'warn'] });

  try {
    process.stdout.write(await app.get(VacancyReportService).build(sourceId));
  } catch (error) {
    logger.error(error instanceof Error ? error.message : 'Report failed', error instanceof Error ? error.stack : undefined);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
