import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VacancyActionKindEnum, VacancyMatchVerdictEnum, VacancyStageEnum } from '@job-agent/shared';

import { type IRegisteredJobsDBTool, registerJobsDBTool } from '../../../../test/jobs-db-tool.harness.js';
import { READ_ONLY_TOOL } from '../helpers/jobs-db-tool.constants.js';
import { JobsDBRepository } from '../repositories/jobs-db.repository.js';
import { PipelineSummaryTool } from './pipeline-summary.tool.js';

describe('PipelineSummaryTool (unit)', () => {
  let moduleFixture: TestingModule;
  let repository: DeepMocked<JobsDBRepository>;
  let tool: IRegisteredJobsDBTool;

  beforeEach(async () => {
    repository = createMock<JobsDBRepository>();
    repository.countPipeline.mockResolvedValue({ byStage: [], byVerdict: [], bySource: [], actions: [], cardsSent: 0 });
    moduleFixture = await Test.createTestingModule({
      providers: [PipelineSummaryTool, { provide: JobsDBRepository, useValue: repository }]
    }).compile();

    tool = registerJobsDBTool(moduleFixture.get(PipelineSummaryTool));
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(moduleFixture.get(PipelineSummaryTool)).toBeDefined();
  });

  it('registers as a read-only tool', () => {
    expect(tool.name).toBe('pipeline_summary');
    expect(tool.annotations).toEqual(READ_ONLY_TOOL);
  });

  it('answers with the counters of the period, the vacancies summed over the stages', async () => {
    repository.countPipeline.mockResolvedValue({
      byStage: [
        { stage: VacancyStageEnum.EXTRACTED, count: 3 },
        { stage: VacancyStageEnum.SKIPPED, count: 4 }
      ],
      byVerdict: [{ profileName: 'developer', verdict: VacancyMatchVerdictEnum.FIT, count: 2 }],
      bySource: [{ sourceId: 3, name: 'Northwind', count: 7 }],
      actions: [{ kind: VacancyActionKindEnum.APPLIED, count: 1 }],
      cardsSent: 2
    });

    const answer = await tool.call({ sinceDays: 7 });

    expect(repository.countPipeline).toHaveBeenCalledWith(7);
    expect(answer.summary).toBe('7 vacancies, 2 cards sent in the last 7 days');
    expect(answer.data).toEqual({
      sinceDays: 7,
      byStage: [
        { stage: VacancyStageEnum.EXTRACTED, count: 3 },
        { stage: VacancyStageEnum.SKIPPED, count: 4 }
      ],
      byVerdict: [{ profile: 'developer', verdict: VacancyMatchVerdictEnum.FIT, count: 2 }],
      bySource: [{ sourceId: 3, source: 'Northwind', count: 7 }],
      actions: [{ kind: VacancyActionKindEnum.APPLIED, count: 1 }],
      cardsSent: 2
    });
  });

  it('counts everything without a period', async () => {
    const answer = await tool.call();

    expect(repository.countPipeline).toHaveBeenCalledWith(undefined);
    expect(answer.data).toMatchObject({ sinceDays: null });
    expect(answer.summary).toBe('0 vacancies, 0 cards sent in all');
  });

  it('refuses a period that is not a positive integer', () => {
    expect(tool.accepts({ sinceDays: 0 })).toBe(false);
    expect(tool.accepts({ sinceDays: 1 })).toBe(true);
  });
});
