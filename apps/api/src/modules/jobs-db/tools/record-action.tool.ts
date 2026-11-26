import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import type { McpServer } from '@job-agent/mcp';
import { VacancyActionKindEnum } from '@job-agent/shared';

import { VacancyActionService } from '../../notify/services/vacancy-action.service.js';
import { JobsDBErrorCodeEnum } from '../enums/jobs-db-error-code.enum.js';
import { JobsDBToolError } from '../errors/jobs-db-tool.error.js';
import type { IJobsDBTool, IToolAnswer, IToolRunner } from '../interfaces/jobs-db-tool.interface.js';
import { JobsDBRepository } from '../repositories/jobs-db.repository.js';

/**
 * Name of the tool
 *
 * @type {string}
 */
const NAME = 'record_action';

/**
 * Input of the tool
 *
 * @type {object}
 */
const INPUT = {
  vacancyId: z.number().int().positive().describe('Vacancy id'),
  kind: z.enum(VacancyActionKindEnum).describe('applied, interested or skipped — the same as the buttons of the card')
};

/**
 * Output of the tool
 *
 * @type {object}
 */
const OUTPUT = {
  vacancyId: z.number().int(),
  title: z.string(),
  company: z.string(),
  kind: z.enum(VacancyActionKindEnum)
};

/**
 * `record_action` — the one write of the server: the owner's choice about a vacancy, as a card button stores it
 */
@Injectable()
export class RecordActionTool implements IJobsDBTool {
  /**
   * @param {VacancyActionService} vacancyActionService
   * @param {JobsDBRepository} jobsDBRepository
   */
  constructor(
    private readonly vacancyActionService: VacancyActionService,
    private readonly jobsDBRepository: JobsDBRepository
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
        title: 'Record a choice about a vacancy',
        description:
          "Store the owner's choice about a vacancy — applied, interested or skipped — exactly as the buttons under its " +
          'Telegram card do. Call it only when the owner says so in this conversation; never infer a choice. Each call ' +
          'adds a record; it changes nothing else.',
        inputSchema: INPUT,
        outputSchema: OUTPUT,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
      },
      async ({ vacancyId, kind }) => run(NAME, async () => this.record(vacancyId, kind))
    );
  }

  /**
   * Store the choice about an existing vacancy
   *
   * @param {number} vacancyId
   * @param {VacancyActionKindEnum} kind
   *
   * @throws {JobsDBToolError} `VACANCY_NOT_FOUND` if there is no such vacancy
   *
   * @returns {Promise<IToolAnswer>}
   */
  private async record(vacancyId: number, kind: VacancyActionKindEnum): Promise<IToolAnswer> {
    const vacancy = await this.jobsDBRepository.findVacancy(vacancyId);

    if (!vacancy) {
      throw new JobsDBToolError(JobsDBErrorCodeEnum.VACANCY_NOT_FOUND, `There is no vacancy ${vacancyId}`);
    }

    await this.vacancyActionService.record(vacancyId, kind);

    return {
      data: { vacancyId, title: vacancy.title, company: vacancy.company, kind },
      summary: `Vacancy ${vacancyId} (${vacancy.title} at ${vacancy.company}) marked ${kind}`
    };
  }
}
