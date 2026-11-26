import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import type { McpServer } from '@job-agent/mcp';
import {
  RoleFamilyEnum,
  SeniorityLevelEnum,
  VacancyActionKindEnum,
  VacancyMatchVerdictEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

import { JobsDBErrorCodeEnum } from '../enums/jobs-db-error-code.enum.js';
import { JobsDBToolError } from '../errors/jobs-db-tool.error.js';
import { READ_ONLY_TOOL, UNTRUSTED_TEXT_NOTE } from '../helpers/jobs-db-tool.constants.js';
import { isoOrNull } from '../helpers/jobs-db-tool.helper.js';
import type { IJobsDBTool, IToolAnswer, IToolRunner } from '../interfaces/jobs-db-tool.interface.js';
import { JobsDBRepository } from '../repositories/jobs-db.repository.js';

/**
 * Name of the tool
 *
 * @type {string}
 */
const NAME = 'get_vacancy';

/**
 * Input of the tool
 *
 * @type {object}
 */
const INPUT = {
  vacancyId: z.number().int().positive().describe('Vacancy id, as find_vacancies or list_applications return it')
};

/**
 * Output of the tool
 *
 * @type {object}
 */
const OUTPUT = {
  vacancy: z.object({
    vacancyId: z.number().int(),
    source: z.string(),
    title: z.string(),
    company: z.string(),
    city: z.string().nullable(),
    country: z.string().nullable(),
    workMode: z.enum(WorkModeEnum).nullable(),
    roleFamily: z.enum(RoleFamilyEnum).nullable(),
    level: z.enum(SeniorityLevelEnum).nullable(),
    stage: z.enum(VacancyStageEnum),
    skipReason: z.string().nullable(),
    url: z.string(),
    textURL: z.string().nullable(),
    extraction: z.record(z.string(), z.unknown()).nullable().describe('Fields the LLM extracted from the page; null before extraction'),
    firstSeenAt: z.string(),
    lastSeenAt: z.string(),
    closedAt: z.string().nullable()
  }),
  verdicts: z
    .array(
      z.object({
        profile: z.string(),
        verdict: z.enum(VacancyMatchVerdictEnum),
        findings: z.array(
          z.object({
            rule: z.string(),
            effect: z.enum(VacancyMatchVerdictEnum).describe('The verdict this finding allows at most'),
            message: z.string()
          })
        ),
        cardSentAt: z.string().nullable()
      })
    )
    .describe('Verdicts of the matching code against the current resume of each profile'),
  actions: z.array(z.object({ kind: z.enum(VacancyActionKindEnum), at: z.string() })).describe("The owner's choices, oldest first")
};

/**
 * `get_vacancy` — one vacancy in full: the extraction, every finding of every verdict, the owner's choices
 */
@Injectable()
export class GetVacancyTool implements IJobsDBTool {
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
        title: 'Get a vacancy',
        description:
          'One vacancy in full: the fields extracted from its page, the verdict against the current resume of each ' +
          'profile with every finding of the matching rules, and the choices the owner made about it. Use it to answer ' +
          `"why is this vacancy no_fit" or "what does this position require". ${UNTRUSTED_TEXT_NOTE}`,
        inputSchema: INPUT,
        outputSchema: OUTPUT,
        annotations: READ_ONLY_TOOL
      },
      async ({ vacancyId }) => run(NAME, async () => this.get(vacancyId))
    );
  }

  /**
   * Read the vacancy, its verdicts and the choices about it
   *
   * @param {number} vacancyId
   *
   * @throws {JobsDBToolError} `VACANCY_NOT_FOUND` if there is no such vacancy
   *
   * @returns {Promise<IToolAnswer>}
   */
  private async get(vacancyId: number): Promise<IToolAnswer> {
    const [vacancy, matches, actions] = await Promise.all([
      this.jobsDBRepository.findVacancy(vacancyId),
      this.jobsDBRepository.findVacancyMatches(vacancyId),
      this.jobsDBRepository.findVacancyActions(vacancyId)
    ]);

    if (!vacancy) {
      throw new JobsDBToolError(JobsDBErrorCodeEnum.VACANCY_NOT_FOUND, `There is no vacancy ${vacancyId}`);
    }

    const { sourceName, data, firstSeenAt, lastSeenAt, closedAt, ...fields } = vacancy;
    const output: z.output<z.ZodObject<typeof OUTPUT>> = {
      vacancy: {
        ...fields,
        source: sourceName,
        extraction: data,
        firstSeenAt: firstSeenAt.toISOString(),
        lastSeenAt: lastSeenAt.toISOString(),
        closedAt: isoOrNull(closedAt)
      },
      verdicts: matches.map(match => ({
        profile: match.profileName,
        verdict: match.verdict,
        findings: match.reasons.map(reason => ({ rule: reason.rule, effect: reason.effect, message: reason.message })),
        cardSentAt: isoOrNull(match.notifiedAt)
      })),
      actions: actions.map(action => ({ kind: action.kind, at: action.at.toISOString() }))
    };

    return { data: output, summary: `Vacancy ${vacancyId}: ${vacancy.title} at ${vacancy.company}, ${vacancy.stage}` };
  }
}
