import { readFile } from 'node:fs/promises';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JobMailKindEnum, LLMStepEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { LLMClient } from '../../llm/clients/l-l-m.client.js';
import { fenceUntrusted } from '../../llm/helpers/untrusted-text.helper.js';
import { clipText } from '../../vacancies/helpers/vacancy-fields.helper.js';
import { senderDomain } from '../helpers/job-mail-address.helper.js';
import type { IJobMailHeaders } from '../interfaces/job-mail-message.interface.js';
import { jobMailTriageSchema } from '../schemas/job-mail-triage.schema.js';

/**
 * Prompt of the mail step, copied next to the compiled code by the build
 *
 * @type {URL}
 */
const PROMPT_URL = new URL('../prompts/job-mail-triage.md', import.meta.url);

/**
 * Tag the headers are fenced in — the prompt names it
 *
 * @type {string}
 */
const JOB_MAILS_TAG = 'mails';

/**
 * Longest sender name and subject sent to the LLM
 *
 * @type {Readonly<{ name: number; subject: number }>}
 */
const HEADER_LIMITS = { name: 80, subject: 300 } as const;

/**
 * Kind of an e-mail the answer left out — a digest missed costs vacancies, a digest read for nothing one listing call
 *
 * @type {JobMailKindEnum}
 */
const UNANSWERED_KIND = JobMailKindEnum.JOB_ALERT;

/**
 * Tells the kind of each e-mail by its headers — sender name, sender domain and subject; the body and the part of the
 * address before `@` never reach the LLM
 */
@Injectable()
export class JobMailTriageService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(JobMailTriageService.name);

  /**
   * @param {LLMClient} llmClient
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly llmClient: LLMClient,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * The kind of every e-mail, in the order given — at most `JOB_MAIL_TRIAGE_BATCH_SIZE` e-mails per call; no e-mail, no call
   *
   * @param {readonly IJobMailHeaders[]} jobMails
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if an answer does not match the schema
   *
   * @returns {Promise<JobMailKindEnum[]>}
   */
  async classify(jobMails: readonly IJobMailHeaders[]): Promise<JobMailKindEnum[]> {
    const chunkSize = this.configService.get('JOB_MAIL_TRIAGE_BATCH_SIZE', { infer: true });
    const kinds: JobMailKindEnum[] = [];

    for (let start = 0; start < jobMails.length; start += chunkSize) {
      kinds.push(...(await this.classifyChunk(jobMails.slice(start, start + chunkSize))));
    }

    return kinds;
  }

  /**
   * One LLM call over a part of the e-mails
   *
   * @param {readonly IJobMailHeaders[]} jobMails
   *
   * @throws {Error} `LLM_OUTPUT_SCHEMA_INVALID` if the answer does not match the schema
   *
   * @returns {Promise<JobMailKindEnum[]>}
   */
  private async classifyChunk(jobMails: readonly IJobMailHeaders[]): Promise<JobMailKindEnum[]> {
    const { data, model } = await this.llmClient.generateBySchema({
      step: LLMStepEnum.MAIL,
      system: await readFile(PROMPT_URL, 'utf8'),
      prompt: fenceUntrusted(JOB_MAILS_TAG, this.render(jobMails)),
      schema: jobMailTriageSchema
    });
    const kinds = new Map<number, JobMailKindEnum>();

    for (const answer of data.mails) {
      if (answer.mail < jobMails.length && !kinds.has(answer.mail)) {
        kinds.set(answer.mail, answer.kind);
      }
    }

    const unanswered = jobMails.length - kinds.size;

    if (unanswered > 0) {
      this.logger.warn({ message: 'Job mail answer left e-mails out, read as job alerts', model, unanswered });
    }

    this.logger.debug({ message: 'Job mails classified', model, jobMails: jobMails.length });

    return jobMails.map((_, index) => kinds.get(index) ?? UNANSWERED_KIND);
  }

  /**
   * One numbered line per e-mail: sender name, sender domain, subject
   *
   * @param {readonly IJobMailHeaders[]} jobMails
   *
   * @returns {string}
   */
  private render(jobMails: readonly IJobMailHeaders[]): string {
    return jobMails
      .map((jobMail, index) => {
        const name = jobMail.senderName ? `${clipText(jobMail.senderName, HEADER_LIMITS.name)} ` : '';
        const subject = clipText(jobMail.subject, HEADER_LIMITS.subject) || '(no subject)';

        return `[${index}] from: ${name}(${senderDomain(jobMail.senderAddress) || 'unknown'}) | subject: ${subject}`;
      })
      .join('\n');
  }
}
