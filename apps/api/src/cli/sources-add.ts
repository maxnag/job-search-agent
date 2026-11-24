import { parseArgs } from 'node:util';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { paint } from '../modules/report/helpers/terminal-style.helper.js';
import type { ISourceRegistrationResult } from '../modules/search/interfaces/source-registration.interface.js';
import { SourceRegistrationService } from '../modules/search/services/source-registration.service.js';
import { ScanCLIModule } from './scan-cli.module.js';

const USAGE = 'Usage: pnpm sources:add <url> [--name <company>]\n';
const logger = new Logger('SourcesAdd');
const { values, positionals } = parseArgs({ allowPositionals: true, options: { name: { type: 'string' } } });
const [url] = positionals;

/**
 * Lines that tell the owner what adding the source did
 *
 * @param {ISourceRegistrationResult} result
 *
 * @returns {string}
 */
function resultLines(result: ISourceRegistrationResult): string {
  const source = result.source;
  const id = paint('bold', '#' + source.source_id);
  const kind = result.board ? `${result.board.kind} ${result.board.board}` : source.source_fetch_mode;

  if (!result.created) {
    return `${id} ${paint('dim', 'already a source')}: ${source.source_name} (${kind}) — ${source.source_url}\n`;
  }

  const lines = [`${id} ${paint('green', 'added')}: ${source.source_name} (${kind}) — ${source.source_url}`];

  if (result.positions !== undefined) {
    const passing = paint('bold', `${result.passing ?? 0} pass the company and place screening`);

    const note =
      result.located === 0
        ? ' — the board gives no country, place, role and level are read at the scan'
        : ' — role and level are read at the scan';

    lines.push(`   ${result.positions} positions, ${passing}` + paint('dim', note));
  }

  lines.push(paint('cyan', `Scan it now: pnpm sources:scan --source ${source.source_id}`));

  return lines.join('\n') + '\n';
}

if (!url || positionals.length > 1) {
  process.stderr.write(USAGE);
  process.exitCode = 1;
} else {
  const app = await NestFactory.createApplicationContext(ScanCLIModule, { logger: ['error', 'warn'] });

  try {
    process.stdout.write(resultLines(await app.get(SourceRegistrationService).add({ url, name: values.name })));
  } catch (error) {
    logger.error(error instanceof Error ? error.message : 'Adding the source failed');
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
