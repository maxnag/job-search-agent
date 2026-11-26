import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import type { McpServer } from '@job-agent/mcp';
import { VacancyActionKindEnum, VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

import { READ_ONLY_TOOL } from '../helpers/jobs-db-tool.constants.js';
import { sinceDaysInput } from '../helpers/jobs-db-tool.helper.js';
import type { IJobsDBTool, IToolAnswer, IToolRunner } from '../interfaces/jobs-db-tool.interface.js';
import { JobsDBRepository } from '../repositories/jobs-db.repository.js';

/**
 * Name of the tool
 *
 * @type {string}
 */
const NAME = 'pipeline_summary';

/**
 * Input of the tool
 *
 * @type {object}
 */
const INPUT = {
  sinceDays: sinceDaysInput('vacancies first seen, choices made and cards sent')
};

/**
 * A counter
 *
 * @returns {z.ZodNumber}
 */
function counter() {
  return z.number().int().nonnegative();
}

/**
 * Output of the tool
 *
 * @type {object}
 */
const OUTPUT = {
  sinceDays: z.number().int().nullable().describe('The period; null — everything'),
  byStage: z.array(z.object({ stage: z.enum(VacancyStageEnum), count: counter() })),
  byVerdict: z
    .array(z.object({ profile: z.string(), verdict: z.enum(VacancyMatchVerdictEnum), count: counter() }))
    .describe('Verdicts against the current resume of each profile'),
  bySource: z.array(z.object({ sourceId: z.number().int(), source: z.string(), count: counter() })),
  actions: z
    .array(z.object({ kind: z.enum(VacancyActionKindEnum), count: counter() }))
    .describe("Vacancies by the owner's latest choice made in the period"),
  cardsSent: counter().describe('Telegram cards sent')
};

/**
 * `pipeline_summary` — the counters of the pipeline over a period
 */
@Injectable()
export class PipelineSummaryTool implements IJobsDBTool {
  /**
   * @param {JobsDBRepository} jobsDBRepository
   */
  constructor(private readonly jobsDBRepository: JobsDBRepository) {}

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
        title: 'Pipeline summary',
        description:
          'Counters of the job search over the last N days, or over everything: vacancies by stage, by verdict per ' +
          'profile and by source, the vacancies by the latest choice the owner made and the Telegram cards sent. Use it for "how is the search ' +
          'going" or a weekly review before drilling down with find_vacancies.',
        inputSchema: INPUT,
        outputSchema: OUTPUT,
        annotations: READ_ONLY_TOOL
      },
      async ({ sinceDays }) => run(NAME, async () => this.summarize(sinceDays))
    );
  }

  /**
   * Count the pipeline
   *
   * @param {number} [sinceDays]
   *
   * @returns {Promise<IToolAnswer>}
   */
  private async summarize(sinceDays?: number): Promise<IToolAnswer> {
    const counts = await this.jobsDBRepository.countPipeline(sinceDays);
    const vacancies = counts.byStage.reduce((sum, row) => sum + row.count, 0);
    const output: z.output<z.ZodObject<typeof OUTPUT>> = {
      sinceDays: sinceDays ?? null,
      byStage: [...counts.byStage],
      byVerdict: counts.byVerdict.map(row => ({ profile: row.profileName, verdict: row.verdict, count: row.count })),
      bySource: counts.bySource.map(row => ({ sourceId: row.sourceId, source: row.name, count: row.count })),
      actions: [...counts.actions],
      cardsSent: counts.cardsSent
    };
    const period = sinceDays === undefined ? 'in all' : `in the last ${sinceDays} days`;

    return { data: output, summary: `${vacancies} vacancies, ${counts.cardsSent} cards sent ${period}` };
  }
}
