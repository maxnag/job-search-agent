import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import type { McpServer } from '@job-agent/mcp';
import { SourceFetchModeEnum, SourceStatusEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { READ_ONLY_TOOL } from '../helpers/jobs-db-tool.constants.js';
import { capRows, isoOrNull, limitInput, totalOutput } from '../helpers/jobs-db-tool.helper.js';
import type { IJobsDBTool, IToolAnswer, IToolRunner } from '../interfaces/jobs-db-tool.interface.js';
import { JobsDBRepository } from '../repositories/jobs-db.repository.js';

/**
 * Name of the tool
 *
 * @type {string}
 */
const NAME = 'list_sources';

/**
 * Input of the tool
 *
 * @type {object}
 */
const INPUT = {
  status: z
    .enum(SourceStatusEnum)
    .optional()
    .describe('Only sources with this status: ok, or stopped by the crawler (blocked, blocked_by_robots)'),
  includeInactive: z.boolean().optional().describe('Include the sources the owner switched off'),
  limit: limitInput()
};

/**
 * Output of the tool
 *
 * @type {object}
 */
const OUTPUT = {
  total: totalOutput(),
  sources: z.array(
    z.object({
      sourceId: z.number().int(),
      name: z.string(),
      url: z.string().describe('Listing page, ATS board or the sender domain of job alerts'),
      fetchMode: z.enum(SourceFetchModeEnum),
      isActive: z.boolean(),
      status: z.enum(SourceStatusEnum),
      lastScanAt: z.string().nullable(),
      lastError: z.string().nullable(),
      openVacancies: z.number().int().nonnegative()
    })
  )
};

/**
 * `list_sources` — the career pages, boards and mail senders the agent reads, with their state
 */
@Injectable()
export class ListSourcesTool implements IJobsDBTool {
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
        title: 'List sources',
        description:
          'The sources the agent reads — career pages, ATS boards, job-alert senders — with their status, the last scan ' +
          'and its error, and how many open vacancies each has. Switched-off sources only when asked. Use it for "which ' +
          'sources are stopped" or to find a source id for find_vacancies.',
        inputSchema: INPUT,
        outputSchema: OUTPUT,
        annotations: READ_ONLY_TOOL
      },
      async input => run(NAME, async () => this.list(input))
    );
  }

  /**
   * Read the sources
   *
   * @param {z.output<z.ZodObject<typeof INPUT>>} input
   *
   * @returns {Promise<IToolAnswer>}
   */
  private async list(input: z.output<z.ZodObject<typeof INPUT>>): Promise<IToolAnswer> {
    const found = await this.jobsDBRepository.findSources({ status: input.status, includeInactive: input.includeInactive });
    const { rows, total } = capRows(found, input.limit, this.configService.get('MCP_MAX_ROWS', { infer: true }));
    const sources = rows.map(row => ({ ...row, lastScanAt: isoOrNull(row.lastScanAt) }));

    return { data: { total, sources }, summary: `${sources.length} of ${total} sources` };
  }
}
