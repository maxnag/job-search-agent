import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VacancyActionKindEnum, VacancyStageEnum } from '@job-agent/shared';

import { type IRegisteredJobsDBTool, registerJobsDBTool } from '../../../../test/jobs-db-tool.harness.js';
import { VacancyActionService } from '../../notify/services/vacancy-action.service.js';
import { JobsDBErrorCodeEnum } from '../enums/jobs-db-error-code.enum.js';
import type { IJobsDBVacancy } from '../interfaces/jobs-db-vacancy.interface.js';
import { JobsDBRepository } from '../repositories/jobs-db.repository.js';
import { RecordActionTool } from './record-action.tool.js';

const VACANCY: IJobsDBVacancy = {
  vacancyId: 7,
  sourceName: 'Northwind',
  title: 'Backend Developer',
  company: 'Northwind',
  city: null,
  country: null,
  workMode: null,
  roleFamily: null,
  level: null,
  stage: VacancyStageEnum.EXTRACTED,
  skipReason: null,
  url: 'https://careers.example.com/jobs/7',
  textURL: null,
  data: null,
  firstSeenAt: new Date('2026-11-20T08:00:00.000Z'),
  lastSeenAt: new Date('2026-11-24T08:00:00.000Z'),
  closedAt: null
};

describe('RecordActionTool (unit)', () => {
  let moduleFixture: TestingModule;
  let actions: DeepMocked<VacancyActionService>;
  let repository: DeepMocked<JobsDBRepository>;
  let tool: IRegisteredJobsDBTool;

  beforeEach(async () => {
    actions = createMock<VacancyActionService>();
    repository = createMock<JobsDBRepository>();
    repository.findVacancy.mockResolvedValue(VACANCY);
    moduleFixture = await Test.createTestingModule({
      providers: [
        RecordActionTool,
        { provide: VacancyActionService, useValue: actions },
        { provide: JobsDBRepository, useValue: repository }
      ]
    }).compile();

    tool = registerJobsDBTool(moduleFixture.get(RecordActionTool));
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(moduleFixture.get(RecordActionTool)).toBeDefined();
  });

  it('registers as the one tool that writes — not destructive, idempotent', () => {
    expect(tool.name).toBe('record_action');
    expect(tool.annotations).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    expect(tool.description).toContain('never infer a choice');
  });

  it('stores the choice as a card button does, without a Telegram message', async () => {
    actions.record.mockResolvedValue(true);

    const answer = await tool.call({ vacancyId: 7, kind: VacancyActionKindEnum.APPLIED });

    expect(actions.record).toHaveBeenCalledWith(7, VacancyActionKindEnum.APPLIED);
    expect(answer.data).toEqual({
      vacancyId: 7,
      title: 'Backend Developer',
      company: 'Northwind',
      kind: VacancyActionKindEnum.APPLIED,
      recorded: true
    });
    expect(answer.summary).toBe('Vacancy 7 (Backend Developer at Northwind) marked applied');
  });

  it('refuses a vacancy that does not exist and stores nothing', async () => {
    repository.findVacancy.mockResolvedValue(undefined);

    await expect(tool.call({ vacancyId: 999, kind: VacancyActionKindEnum.SKIPPED })).rejects.toMatchObject({
      code: JobsDBErrorCodeEnum.VACANCY_NOT_FOUND
    });
    expect(actions.record).not.toHaveBeenCalled();
  });

  it('passes a failed write on', async () => {
    actions.record.mockRejectedValue(new Error('foreign key violation'));

    await expect(tool.call({ vacancyId: 7, kind: VacancyActionKindEnum.INTERESTED })).rejects.toThrow('foreign key violation');
  });

  it('needs both the vacancy and a choice the buttons have', () => {
    expect(tool.accepts({ vacancyId: 7 })).toBe(false);
    expect(tool.accepts({ kind: VacancyActionKindEnum.APPLIED })).toBe(false);
    expect(tool.accepts({ vacancyId: 7, kind: 'hired' })).toBe(false);
    expect(tool.accepts({ vacancyId: 7, kind: VacancyActionKindEnum.APPLIED })).toBe(true);
  });
});
