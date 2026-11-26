import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import type { McpServer } from '@job-agent/mcp';
import { VacancyMatchVerdictEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import type { IReportMatch, IReportVacancy } from '../../report/interfaces/vacancy-report.interface.js';
import { VacancyReportRepository } from '../../report/repositories/vacancy-report.repository.js';
import { READ_ONLY_TOOL, UNTRUSTED_TEXT_NOTE } from '../helpers/jobs-db-tool.constants.js';
import { capRows, limitInput, sinceDaysInput, totalOutput } from '../helpers/jobs-db-tool.helper.js';
import type { IJobsDBTool, IToolAnswer, IToolRunner } from '../interfaces/jobs-db-tool.interface.js';

/**
 * Name of the tool
 *
 * @type {string}
 */
const NAME = 'find_vacancies';

/**
 * Input of the tool — the filter of `vacancies:report`
 *
 * @type {object}
 */
const INPUT = {
  stages: z.array(z.enum(VacancyStageEnum)).optional().describe('At one of these stages'),
  verdicts: z
    .array(z.enum(VacancyMatchVerdictEnum))
    .optional()
    .describe('With one of these verdicts against the current resume of any profile'),
  country: z.string().length(2).optional().describe('Country of the position, ISO code: IL, UA'),
  workMode: z.enum(WorkModeEnum).optional().describe('Work mode of the position'),
  title: z.string().min(1).optional().describe('The title contains the text, case aside'),
  company: z.string().min(1).optional().describe('The company contains the text, case aside'),
  reason: z.string().min(1).optional().describe('The skip reason or a finding of a verdict contains the text, case aside'),
  sourceIds: z.array(z.number().int().positive()).optional().describe('Positions of these sources (ids from list_sources)'),
  sinceDays: sinceDaysInput('positions first seen'),
  closed: z.boolean().optional().describe('Include closed positions — hidden by default'),
  limit: limitInput()
};

/**
 * A verdict as the list shows it
 *
 * @type {z.ZodObject}
 */
const VERDICT = z.object({
  profile: z.string(),
  verdict: z.enum(VacancyMatchVerdictEnum),
  findings: z.array(z.string()).describe('What lowered the verdict; empty for a clean fit')
});

/**
 * Output of the tool
 *
 * @type {object}
 */
const OUTPUT = {
  total: totalOutput(),
  vacancies: z.array(
    z.object({
      vacancyId: z.number().int(),
      title: z.string(),
      company: z.string(),
      city: z.string().nullable(),
      country: z.string().nullable(),
      workMode: z.enum(WorkModeEnum).nullable(),
      stage: z.enum(VacancyStageEnum),
      skipReason: z.string().nullable().describe('Why the code filter dropped it, before any extraction'),
      source: z.string(),
      firstSeenAt: z.string(),
      url: z.string(),
      textURL: z.string().nullable().describe('The same position on the company board, when url is never opened'),
      verdicts: z.array(VERDICT)
    })
  )
};

/**
 * `find_vacancies` — the positions a filter selects, newest first, with their stage and verdicts
 */
@Injectable()
export class FindVacanciesTool implements IJobsDBTool {
  /**
   * @param {VacancyReportRepository} vacancyReportRepository
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly vacancyReportRepository: VacancyReportRepository,
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
        title: 'Find vacancies',
        description:
          'Search the vacancies the agent collected from career pages, ATS boards and job alerts. Filters combine with AND, ' +
          'the values of one list filter with OR. Use it for questions like "fit vacancies of the last week" or "what was ' +
          'dropped for Hebrew". Returns the newest positions first with their stage and verdict per profile; call ' +
          `get_vacancy for the full extraction and every finding. ${UNTRUSTED_TEXT_NOTE}`,
        inputSchema: INPUT,
        outputSchema: OUTPUT,
        annotations: READ_ONLY_TOOL
      },
      async input => run(NAME, async () => this.find(input))
    );
  }

  /**
   * Run the filter of the report and shape the newest positions
   *
   * @param {z.output<z.ZodObject<typeof INPUT>>} input
   *
   * @returns {Promise<IToolAnswer>}
   */
  private async find(input: z.output<z.ZodObject<typeof INPUT>>): Promise<IToolAnswer> {
    const { limit, ...filter } = input;
    const report = await this.vacancyReportRepository.findAll(filter);
    const sourceNames = new Map(report.sources.map(source => [source.sourceId, source.name]));
    const newest = [...report.vacancies].sort((left, right) => right.vacancyId - left.vacancyId);
    const { rows, total } = capRows(newest, limit, this.configService.get('MCP_MAX_ROWS', { infer: true }));
    const matches = Map.groupBy(report.matches, match => match.vacancyId);
    const vacancies = rows.map(vacancy =>
      this.shape(vacancy, sourceNames.get(vacancy.sourceId) ?? '', matches.get(vacancy.vacancyId) ?? [])
    );

    return { data: { total, vacancies }, summary: `${vacancies.length} of ${total} vacancies, newest first` };
  }

  /**
   * A position with its verdicts
   *
   * @param {IReportVacancy} vacancy
   * @param {string} source
   * @param {readonly IReportMatch[]} matches Its verdicts
   *
   * @returns {z.output<typeof OUTPUT.vacancies.element>}
   */
  private shape(vacancy: IReportVacancy, source: string, matches: readonly IReportMatch[]): z.output<typeof OUTPUT.vacancies.element> {
    return {
      vacancyId: vacancy.vacancyId,
      title: vacancy.title,
      company: vacancy.company,
      city: vacancy.city,
      country: vacancy.country,
      workMode: vacancy.workMode,
      stage: vacancy.stage,
      skipReason: vacancy.skipReason,
      source,
      firstSeenAt: vacancy.firstSeenAt.toISOString(),
      url: vacancy.url,
      textURL: vacancy.textURL,
      verdicts: matches.map(match => ({
        profile: match.profileName,
        verdict: match.verdict,
        findings: match.reasons.filter(reason => reason.effect !== VacancyMatchVerdictEnum.FIT).map(reason => reason.message)
      }))
    };
  }
}
