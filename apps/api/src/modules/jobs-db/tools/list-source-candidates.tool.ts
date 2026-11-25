import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import type { McpServer } from '@job-agent/mcp';
import { ATSKindEnum, SourceCandidateStatusEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import { READ_ONLY_TOOL, UNTRUSTED_TEXT_NOTE } from '../helpers/jobs-db-tool.constants.js';
import { capRows, limitInput, totalOutput } from '../helpers/jobs-db-tool.helper.js';
import type { IJobsDBTool, IToolAnswer, IToolRunner } from '../interfaces/jobs-db-tool.interface.js';
import { JobsDBRepository } from '../repositories/jobs-db.repository.js';

/**
 * Name of the tool
 *
 * @type {string}
 */
const NAME = 'list_source_candidates';

/**
 * Input of the tool
 *
 * @type {object}
 */
const INPUT = {
  status: z
    .enum(SourceCandidateStatusEnum)
    .optional()
    .describe('proposed — offered and not decided, added, ignored, empty — no fitting positions'),
  limit: limitInput()
};

/**
 * Output of the tool
 *
 * @type {object}
 */
const OUTPUT = {
  total: totalOutput(),
  candidates: z.array(
    z.object({
      sourceCandidateId: z.number().int(),
      company: z.string(),
      atsKind: z.enum(ATSKindEnum),
      board: z.string(),
      status: z.enum(SourceCandidateStatusEnum),
      positions: z.number().int().describe('Open positions on the board'),
      matching: z.number().int().describe('Positions the profiles want'),
      unknown: z.number().int().describe('Positions whose place is not known well enough to judge'),
      examples: z.array(z.string()).describe('A few matching position titles'),
      checkedAt: z.string(),
      sourceId: z.number().int().nullable().describe('The source it became, once added')
    })
  )
};

/**
 * `list_source_candidates` — the company boards the discovery found and offered
 */
@Injectable()
export class ListSourceCandidatesTool implements IJobsDBTool {
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
        title: 'List source candidates',
        description:
          'Company boards on Comeet, Greenhouse or Lever that the discovery found by web search, with how many of their ' +
          'positions fit the profiles and what the owner decided. Latest checked first. Use it for "which companies did ' +
          `discovery suggest". Adding a board is the owner's button in Telegram, not a tool. ${UNTRUSTED_TEXT_NOTE}`,
        inputSchema: INPUT,
        outputSchema: OUTPUT,
        annotations: READ_ONLY_TOOL
      },
      async input => run(NAME, async () => this.list(input))
    );
  }

  /**
   * Read the candidates
   *
   * @param {z.output<z.ZodObject<typeof INPUT>>} input
   *
   * @returns {Promise<IToolAnswer>}
   */
  private async list(input: z.output<z.ZodObject<typeof INPUT>>): Promise<IToolAnswer> {
    const found = await this.jobsDBRepository.findSourceCandidates(input.status);
    const { rows, total } = capRows(found, input.limit, this.configService.get('MCP_MAX_ROWS', { infer: true }));
    const candidates = rows.map(row => ({
      sourceCandidateId: row.source_candidate_id,
      company: row.source_candidate_company,
      atsKind: row.source_candidate_ats_kind,
      board: row.source_candidate_board,
      status: row.source_candidate_status,
      positions: row.source_candidate_positions,
      matching: row.source_candidate_matching,
      unknown: row.source_candidate_unknown,
      examples: row.source_candidate_examples,
      checkedAt: row.source_candidate_checked_at.toISOString(),
      sourceId: row.source_id
    }));

    return { data: { total, candidates }, summary: `${candidates.length} of ${total} boards` };
  }
}
