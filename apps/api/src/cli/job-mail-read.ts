import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { JobMailKindEnum } from '@job-agent/shared';

import { senderDomain } from '../modules/job-mail/helpers/job-mail-address.helper.js';
import type { IJobMailPreview, IJobMailPreviewMessage } from '../modules/job-mail/interfaces/job-mail-preview.interface.js';
import type { IJobMailReadSummary } from '../modules/job-mail/interfaces/job-mail-read-summary.interface.js';
import { JobMailReadOrchestrator } from '../modules/job-mail/services/job-mail-read.orchestrator.js';
import { paint } from '../modules/report/helpers/terminal-style.helper.js';
import type { TextFormat } from '../modules/report/interfaces/text-format.interface.js';
import type { ILinkCandidate } from '../modules/search/interfaces/link-candidate.interface.js';
import { readCLI } from './helpers/c-l-i-args.helper.js';
import type { ICLISpec } from './helpers/interfaces/c-l-i-spec.interface.js';

/**
 * Options and help of the command
 *
 * @type {ICLISpec}
 */
const SPEC: ICLISpec = {
  command: 'job-mail:read',
  summary:
    'Read the mailbox now: the e-mails of the last JOB_MAIL_LOOKBACK_HOURS not read before, the kind of each told by the LLM from its headers; the vacancies of every job alert are screened and queued for extraction.',
  options: [
    {
      name: 'dry-run',
      description: 'Read and classify every e-mail of the window, read before or not, and show the links of the job alerts; store nothing'
    },
    { name: 'hours', value: 'n', description: 'Width of the window in hours instead of JOB_MAIL_LOOKBACK_HOURS', integer: true }
  ],
  examples: [
    { args: '', description: 'Read the new e-mails of the last day, as the schedule does' },
    { args: '--hours 72', description: 'Catch up after the API was off for three days' },
    { args: '--dry-run', description: 'See the kind of every e-mail of the last day and the links of the job alerts' },
    { args: '--dry-run --hours 72', description: 'The same for the last three days' }
  ],
  notes: [
    'Needs JOB_MAIL_IMAP_USER and JOB_MAIL_IMAP_PASSWORD (a Gmail app password) in .env. The mailbox is opened read-only.',
    'Only the headers go to the LLM; a subject is shown here for a job alert only, the query of a link only by its parameter names.',
    'The queued vacancies are extracted by the running API — start it with pnpm api:dev.'
  ]
};

const logger = new Logger('JobMailRead');
const args = readCLI(SPEC);
const hoursValue = args?.values.hours?.[0];
const hours = hoursValue === undefined ? undefined : +hoursValue;

/**
 * Color of every kind of e-mail
 *
 * @type {Readonly<Record<JobMailKindEnum, TextFormat>>}
 */
const KIND_FORMATS: Readonly<Record<JobMailKindEnum, TextFormat>> = {
  [JobMailKindEnum.JOB_ALERT]: 'green',
  [JobMailKindEnum.RECRUITER]: 'cyan',
  [JobMailKindEnum.OTHER]: 'dim'
};

/**
 * A link with the values of its query left out — they carry the tracking tokens of the account
 *
 * @param {string} url
 *
 * @returns {string}
 */
function maskedURL(url: string): string {
  const parsed = URL.parse(url);

  if (!parsed) {
    return url;
  }

  const query = [...parsed.searchParams.keys()].map(name => name + '=…').join('&');

  return parsed.origin + parsed.pathname + (query ? '?' + query : '');
}

/**
 * One line of a link of a job alert
 *
 * @param {ILinkCandidate} link
 * @param {number} index
 *
 * @returns {string}
 */
function linkLine(link: ILinkCandidate, index: number): string {
  const text = link.text || paint('dim', '(no text)');

  const target = paint('dim', '→ ' + maskedURL(link.url));

  return `    [${index}] ${text} ${target}`;
}

/**
 * The lines of one e-mail: time, kind and sender domain; the subject and the links of a job alert only
 *
 * @param {IJobMailPreviewMessage} message
 *
 * @returns {string[]}
 */
function messageLines(message: IJobMailPreviewMessage): string[] {
  const time = message.headers.receivedAt.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
  const kind = paint(KIND_FORMATS[message.kind], message.kind.padEnd(9));
  const domain = senderDomain(message.headers.senderAddress) || 'unknown';

  if (message.kind !== JobMailKindEnum.JOB_ALERT) {
    return [`${time} ${kind} ${domain}`];
  }

  const subject = paint('bold', message.headers.subject || '(no subject)');
  const links = paint('dim', `— ${message.links.length} links`);

  return [`${time} ${kind} ${domain} ${subject} ${links}`, ...message.links.map((link, index) => linkLine(link, index))];
}

/**
 * The report of a reading
 *
 * @param {IJobMailReadSummary} summary
 *
 * @returns {string}
 */
function readReport(summary: IJobMailReadSummary): string {
  const failed = summary.failed > 0 ? paint('red', ', ' + summary.failed + ' failed') : '';
  const created = paint('green', summary.created + ' new');
  const lines = [
    `${summary.mails} e-mails since ${summary.since.toLocaleString('sv-SE')}, ${summary.fresh} not read before`,
    `${summary.alerts} job alerts read${failed}`,
    `${summary.positions} positions, ${created}, ${summary.queued} queued for extraction`
  ];

  return lines.join('\n') + '\n';
}

/**
 * The report of a dry run
 *
 * @param {IJobMailPreview} preview
 *
 * @returns {string}
 */
function report(preview: IJobMailPreview): string {
  const counts = Object.values(JobMailKindEnum).map(kind => `${preview.messages.filter(message => message.kind === kind).length} ${kind}`);
  const header = `${preview.messages.length} e-mails since ${preview.since.toLocaleString('sv-SE')}: ${counts.join(', ')}`;

  return (
    [header, ...preview.messages.flatMap(message => messageLines(message)), paint('dim', 'Dry run: nothing stored.')].join('\n') + '\n'
  );
}

if (args) {
  const { ScanCLIModule } = await import('./scan-cli.module.js');
  const app = await NestFactory.createApplicationContext(ScanCLIModule, { logger: ['error', 'warn'] });

  try {
    const jobMail = app.get(JobMailReadOrchestrator);

    if (!jobMail.isEnabled()) {
      process.stderr.write('Job mail is off: set JOB_MAIL_IMAP_USER and JOB_MAIL_IMAP_PASSWORD in .env.\n');
      process.exitCode = 1;
    } else if (args.flags.has('dry-run')) {
      process.stdout.write(report(await jobMail.preview(hours)));
    } else {
      process.stdout.write(readReport(await jobMail.read(hours)));
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : 'Job mail reading failed');
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
