import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type IVacancyCard, type IVacancyListPage, SortOrderEnum, VacancyActionKindEnum, VacancySortEnum } from '@job-agent/shared';

import { VacanciesAPIService } from '../services/vacancies-a-p-i.service.js';
import { VacanciesController } from './vacancies.controller.js';

describe('VacanciesController (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: VacanciesController;
  let service: DeepMocked<VacanciesAPIService>;

  beforeEach(async () => {
    service = createMock<VacanciesAPIService>();
    moduleFixture = await Test.createTestingModule({
      controllers: [VacanciesController],
      providers: [{ provide: VacanciesAPIService, useValue: service }]
    }).compile();

    subjectUnderTest = moduleFixture.get(VacanciesController);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('answers a page of the list', async () => {
    const page: IVacancyListPage = { total: 0, page: 1, pageSize: 25, vacancies: [] };
    const query = { sort: VacancySortEnum.TITLE, order: SortOrderEnum.ASC, page: 1, pageSize: 25 };

    service.findAll.mockResolvedValue(page);

    await expect(subjectUnderTest.findAll(query)).resolves.toBe(page);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('answers the values of the filters', async () => {
    service.findFilterOptions.mockResolvedValue({ sources: [], countries: ['IL'], cities: [] });

    await expect(subjectUnderTest.findFilterOptions()).resolves.toEqual({ sources: [], countries: ['IL'], cities: [] });
  });

  it('answers a card', async () => {
    const card = { vacancyId: 7 } as IVacancyCard;

    service.findOne.mockResolvedValue(card);

    await expect(subjectUnderTest.findOne(7)).resolves.toBe(card);
  });

  it('passes "not found" of a card on', async () => {
    service.findOne.mockRejectedValue(new NotFoundException());

    await expect(subjectUnderTest.findOne(7)).rejects.toThrow(NotFoundException);
  });

  it('records a choice', async () => {
    service.recordAction.mockResolvedValue({ kind: VacancyActionKindEnum.APPLIED, recorded: true });

    await expect(subjectUnderTest.recordAction(7, { kind: VacancyActionKindEnum.APPLIED })).resolves.toEqual({
      kind: VacancyActionKindEnum.APPLIED,
      recorded: true
    });
    expect(service.recordAction).toHaveBeenCalledWith(7, VacancyActionKindEnum.APPLIED);
  });

  it('passes "not found" of a choice on', async () => {
    service.recordAction.mockRejectedValue(new NotFoundException());

    await expect(subjectUnderTest.recordAction(7, { kind: VacancyActionKindEnum.APPLIED })).rejects.toThrow(NotFoundException);
  });
});
