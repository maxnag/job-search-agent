import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import type { McpServer } from '@job-agent/mcp';
import { VacancyActionKindEnum, VacancyStageEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { READ_ONLY_TOOL, UNTRUSTED_TEXT_NOTE } from '../helpers/jobs-db-tool.constants.js';
import { capRows, isoOrNull, limitInput, sinceDaysInput, totalOutput } from '../helpers/jobs-db-tool.helper.js';
import type { IJobsDBTool, IToolAnswer, IToolRunner } from '../interfaces/jobs-db-tool.interface.js';
import { JobsDBRepository } from '../repositories/jobs-db.repository.js';

/**
 * Name of the tool
 *
 * @type {string}
 */
const NAME = 'list_applications';

/**
 * Input of the tool
 *
 * @type {object}
 */
const INPUT = {
  kind: z
    .enum(VacancyActionKindEnum)
    .default(VacancyActionKindEnum.APPLIED)
    .describe('The choice: applied (default), interested or skipped'),
  sinceDays: sinceDaysInput('choices made'),
  limit: limitInput()
};

/**
 * Output of the tool
 *
 * @type {object}
 */
const OUTPUT = {
  kind: z.enum(VacancyActionKindEnum),
  total: totalOutput(),
  applications: z.array(
    z.object({
      vacancyId: z.number().int(),
      title: z.string(),
      company: z.string(),
      city: z.string().nullable(),
      country: z.string().nullable(),
      stage: z.enum(VacancyStageEnum).describe('Stage now; closed — the position is gone from its listing'),
      closedAt: z.string().nullable(),
      url: z.string(),
      at: z.string().describe('When the owner made the choice')
    })
  )
};

/**
 * `list_applications` — the vacancies the owner applied to (or marked otherwise), with what became of them
 */
@Injectable()
export class ListApplicationsTool implements IJobsDBTool {
  /**
   * @param {JobsDBRepository} jobsDBRepository
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly jobsDBRepository: JobsDBRepository,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * Register the tool on the server
   *
   * @param {McpServer} server
   * @param {IToolRunner} run
   *
   * @returns {void}
   */
  register(server: McpServer, run: IToolRunner): void {
    server.registerTool(
      NAME,
      {
        title: 'List applications',
        description:
          'The vacancies the owner marked as applied (by default), interested or skipped — from the Telegram card buttons ' +
          'or record_action — each once with the latest such mark, newest first, and whether the position has closed ' +
          `since. Use it for "where did I apply this week". ${UNTRUSTED_TEXT_NOTE}`,
        inputSchema: INPUT,
        outputSchema: OUTPUT,
        annotations: READ_ONLY_TOOL
      },
      async input => run(NAME, async () => this.list(input))
    );
  }

  /**
   * Read the marked vacancies
   *
   * @param {z.output<z.ZodObject<typeof INPUT>>} input
   *
   * @returns {Promise<IToolAnswer>}
   */
  private async list(input: z.output<z.ZodObject<typeof INPUT>>): Promise<IToolAnswer> {
    const found = await this.jobsDBRepository.findApplications({ kind: input.kind, sinceDays: input.sinceDays });
    const { rows, total } = capRows(found, input.limit, this.configService.get('MCP_MAX_ROWS', { infer: true }));
    const applications = rows.map(row => ({ ...row, closedAt: isoOrNull(row.closedAt), at: row.at.toISOString() }));

    return {
      data: { kind: input.kind, total, applications },
      summary: `${applications.length} of ${total} vacancies marked ${input.kind}`
    };
  }
}
