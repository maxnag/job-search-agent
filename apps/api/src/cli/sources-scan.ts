import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { paint } from '../modules/report/helpers/terminal-style.helper.js';
import type { TextFormat } from '../modules/report/interfaces/text-format.interface.js';
import { SourceScanOutcomeEnum } from '../modules/search/enums/source-scan-outcome.enum.js';
import type { ISourceScanSummary } from '../modules/search/interfaces/source-scan-summary.interface.js';
import { SourceRepository } from '../modules/search/repositories/source.repository.js';
import { SourceScanOrchestrator } from '../modules/search/services/source-scan.orchestrator.js';
import { readCLI } from './helpers/c-l-i-args.helper.js';
import type { ICLISpec } from './helpers/interfaces/c-l-i-spec.interface.js';

/**
 * Options and help of the command
 *
 * @type {ICLISpec}
 */
const SPEC: ICLISpec = {
  command: 'sources:scan',
  summary:
    'Scan career pages now: read each listing, pick and screen the vacancy links and queue the new ones for extraction. Without --source — every switched-on source the crawler has not stopped.',
  options: [
    { name: 'source', value: 'id', description: 'Scan only this source', integer: true },
    {
      name: 'force',
      description: 'Scan a source the crawler stopped or the owner switched off; without --source, every switched-on one'
    }
  ],
  examples: [
    { args: '', description: 'Scan the sources the schedule would' },
    { args: '--source 7', description: 'Scan one source' },
    { args: '--source 7 --force', description: 'Scan a source again after it was stopped (403, 429, captcha)' }
  ],
  notes: ['The queued vacancies are extracted by the running API — start it with pnpm api:dev.']
};

const logger = new Logger('SourcesScan');
const args = readCLI(SPEC);
const force = args?.flags.has('force') ?? false;
const source = args?.values.source?.[0];
const sourceId = source === undefined ? undefined : +source;

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

if (args) {
  const { ScanCLIModule } = await import('./scan-cli.module.js');
  const app = await NestFactory.createApplicationContext(ScanCLIModule, { logger: ['error', 'warn'] });

  try {
    const ids = sourceId === undefined ? await sourceIds(app.get(SourceRepository), force) : [sourceId];

    if (ids.length === 0) {
      process.stdout.write('No source to scan. Add career pages to the sources table, switch them on, or pass --force.\n');
    }

    for (const id of ids) {
      try {
        process.stdout.write(summaryLine(await app.get(SourceScanOrchestrator).scan({ sourceId: id, force })));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);

        process.stdout.write(`${paint('bold', '#' + id)} ${paint('red', 'failed')}: ${reason}\n`);
        process.exitCode = 1;
      }
    }

    process.stdout.write(paint('dim', 'The queued vacancies are extracted by the running API (pnpm api:dev).\n'));
  } catch (error) {
    logger.error(error instanceof Error ? error.message : 'Scan failed', error instanceof Error ? error.stack : undefined);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
