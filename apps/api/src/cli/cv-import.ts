import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

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
  } catch (error) {
    logger.error(error instanceof Error ? error.message : 'Import failed', error instanceof Error ? error.stack : undefined);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
