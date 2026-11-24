import { parseArgs } from 'node:util';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { SourceCandidateStatusEnum } from '@job-agent/shared';

import { DiscoveryStageEnum } from '../modules/discovery/enums/discovery-stage.enum.js';
import type { IDiscoveryProgress } from '../modules/discovery/interfaces/discovery-progress.interface.js';
import type { IDiscoveredBoard, IDiscoverySummary } from '../modules/discovery/interfaces/discovery-summary.interface.js';
import { DiscoveryOrchestrator } from '../modules/discovery/services/discovery.orchestrator.js';
import { paint } from '../modules/report/helpers/terminal-style.helper.js';
import { ScanCLIModule } from './scan-cli.module.js';

const logger = new Logger('SourcesDiscover');
const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = values['dry-run'];

/**
 * A progress line on stderr — the report itself goes to stdout
 *
 * @param {IDiscoveryProgress} progress
 *
 * @returns {void}
 */
function showProgress(progress: IDiscoveryProgress): void {
  const step = progress.stage === DiscoveryStageEnum.QUERY ? 'query' : 'board';
  const board = progress.board ? `: ${progress.board}` : '';

  process.stderr.write(paint('dim', `${step} ${progress.done}/${progress.total}${board}\n`));
}

/**
 * One line of a board the run read
 *
 * @param {IDiscoveredBoard} board
 *
 * @returns {string}
 */
function boardLine(board: IDiscoveredBoard): string {
  const proposed = board.status === SourceCandidateStatusEnum.PROPOSED;
  const status = paint(proposed ? 'green' : 'dim', board.status.padEnd(8));
  const unknown = board.unknown > 0 ? `, ${board.unknown} with an unknown place` : '';
  const counts = `${board.positions} positions, ${board.matching} pass the company and place screening${unknown}`;

  return `${status} ${paint('bold', board.company)} (${board.kind} ${board.board}): ${proposed ? counts : paint('dim', counts)}`;
}

/**
 * The report of a run: the totals, then the proposed boards first
 *
 * @param {IDiscoverySummary} summary
 *
 * @returns {string}
 */
function report(summary: IDiscoverySummary): string {
  const boards = [...summary.discovered].sort((left, right) => right.matching - left.matching);
  const totals = `${summary.queries} queries, ${summary.boards} boards found, ${summary.known} already known, ${summary.failed} not read`;
  const cards = dryRun ? [] : [paint('cyan', `${summary.cards} cards queued for Telegram; more come once the open ones are decided.`)];
  const footer = dryRun
    ? paint('dim', 'Dry run: nothing stored, no card queued.')
    : paint('dim', 'Or add a board by hand: pnpm sources:add <board url>.');

  return [totals, ...boards.map(board => boardLine(board)), ...cards, footer].join('\n') + '\n';
}

const app = await NestFactory.createApplicationContext(ScanCLIModule, { logger: ['error', 'warn'] });

try {
  const discovery = app.get(DiscoveryOrchestrator);

  if (discovery.isEnabled()) {
    process.stdout.write(report(await discovery.discover(dryRun, showProgress)));
  } else {
    process.stderr.write('Discovery is off: set BRAVE_SEARCH_API_KEY in .env.\n');
    process.exitCode = 1;
  }
} catch (error) {
  logger.error(error instanceof Error ? error.message : 'Discovery failed');
  process.exitCode = 1;
} finally {
  await app.close();
}
