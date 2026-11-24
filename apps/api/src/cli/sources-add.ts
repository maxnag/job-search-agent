import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { paint } from '../modules/report/helpers/terminal-style.helper.js';
import type { ISourceRegistrationResult } from '../modules/search/interfaces/source-registration.interface.js';
import { SourceRegistrationService } from '../modules/search/services/source-registration.service.js';
import { readCLI } from './helpers/c-l-i-args.helper.js';
import type { ICLISpec } from './helpers/interfaces/c-l-i-spec.interface.js';

/**
 * Arguments, options and help of the command
 *
 * @type {ICLISpec}
 */
const SPEC: ICLISpec = {
  command: 'sources:add',
  summary:
    'Add a career page or an ATS board (Comeet, Greenhouse, Lever) as a source. A board is read once to show how many positions pass the screening.',
  arguments: [{ name: 'url', description: 'Career page, or any link to a board or one of its positions', required: true }],
  options: [{ name: 'name', value: 'company', description: 'Company name — by default the board names it, or the host of the page' }],
  examples: [
    { args: 'https://careers.example.com/jobs', description: 'Add a career page' },
    { args: 'https://boards.greenhouse.io/northwind --name Northwind', description: 'Add a Greenhouse board under a name' }
  ],
  notes: ['A URL that is already a source is not added twice — the command names the source.']
};

const logger = new Logger('SourcesAdd');
const args = readCLI(SPEC);
const [url] = args?.positionals ?? [];

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

if (url !== undefined) {
  const { ScanCLIModule } = await import('./scan-cli.module.js');
  const app = await NestFactory.createApplicationContext(ScanCLIModule, { logger: ['error', 'warn'] });

  try {
    process.stdout.write(resultLines(await app.get(SourceRegistrationService).add({ url, name: args?.values.name?.[0] })));
  } catch (error) {
    logger.error(error instanceof Error ? error.message : 'Adding the source failed');
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
