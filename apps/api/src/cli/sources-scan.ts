import { parseArgs } from 'node:util';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { paint } from '../modules/report/helpers/terminal-style.helper.js';
import type { TextFormat } from '../modules/report/interfaces/text-format.interface.js';
import { SourceScanOutcomeEnum } from '../modules/search/enums/source-scan-outcome.enum.js';
import type { ISourceScanSummary } from '../modules/search/interfaces/source-scan-summary.interface.js';
import { SourceRepository } from '../modules/search/repositories/source.repository.js';
import { SourceScanOrchestrator } from '../modules/search/services/source-scan.orchestrator.js';
import { ScanCLIModule } from './scan-cli.module.js';

const USAGE = 'Usage: pnpm sources:scan [--source <id>] [--force]\n';
const logger = new Logger('SourcesScan');
const { values } = parseArgs({ options: { source: { type: 'string' }, force: { type: 'boolean', default: false } } });
const sourceId = values.source === undefined ? undefined : +values.source;

/**
 * Color of every outcome of a scan
 *
 * @type {Readonly<Record<SourceScanOutcomeEnum, TextFormat>>}
 */
const OUTCOME_FORMATS: Readonly<Record<SourceScanOutcomeEnum, TextFormat>> = {
  [SourceScanOutcomeEnum.SCANNED]: 'green',
  [SourceScanOutcomeEnum.SKIPPED]: 'dim',
  [SourceScanOutcomeEnum.BLOCKED]: 'red'
};

/**
 * One line of the result of a scan
 *
 * @param {ISourceScanSummary} summary
 *
 * @returns {string}
 */
function summaryLine(summary: ISourceScanSummary): string {
  const source = paint('bold', '#' + summary.sourceId);
  const outcome = paint(OUTCOME_FORMATS[summary.outcome], summary.outcome);
  const counts = [
    `${summary.links} links`,
    `${summary.positions} positions`,
    paint('bold', `${summary.created} new`),
    `${summary.skipped} skipped`,
    `${summary.closed} closed`,
    paint('cyan', `${summary.queued} queued for extraction`)
  ];

  return `${source} ${outcome}: ${counts.join(', ')}\n`;
}

/**
 * Sources a run without `--source` scans: those of the schedule, or with `--force` every switched-on one
 *
 * @param {SourceRepository} sources
 * @param {boolean} force
 *
 * @returns {Promise<number[]>}
 */
async function sourceIds(sources: SourceRepository, force: boolean): Promise<number[]> {
  const rows = force ? await sources.findActive() : await sources.findScannable();

  return rows.map(source => source.source_id);
}

if (sourceId !== undefined && !Number.isInteger(sourceId)) {
  process.stderr.write(USAGE);
  process.exitCode = 1;
} else {
  const app = await NestFactory.createApplicationContext(ScanCLIModule, { logger: ['error', 'warn'] });

  try {
    const ids = sourceId === undefined ? await sourceIds(app.get(SourceRepository), values.force) : [sourceId];

    if (ids.length === 0) {
      process.stdout.write('No source to scan. Add career pages to the sources table, switch them on, or pass --force.\n');
    }

    for (const id of ids) {
      try {
        process.stdout.write(summaryLine(await app.get(SourceScanOrchestrator).scan({ sourceId: id, force: values.force })));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);

        process.stdout.write(`${paint('bold', '#' + id)} ${paint('red', 'failed')}: ${reason}\n`);
        process.exitCode = 1;
      }
    }

    process.stdout.write(paint('dim', 'The queued vacancies are extracted by the running API (pnpm dev).\n'));
  } catch (error) {
    logger.error(error instanceof Error ? error.message : 'Scan failed', error instanceof Error ? error.stack : undefined);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
