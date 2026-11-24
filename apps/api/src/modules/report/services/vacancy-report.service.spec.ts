import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VacancyReportRepository } from '../repositories/vacancy-report.repository.js';
import { VacancyReportService } from './vacancy-report.service.js';

describe('VacancyReportService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: VacancyReportService;
  let reports: DeepMocked<VacancyReportRepository>;

  beforeEach(async () => {
    reports = createMock<VacancyReportRepository>();
    moduleFixture = await Test.createTestingModule({
      providers: [VacancyReportService, { provide: VacancyReportRepository, useValue: reports }]
    }).compile();

    subjectUnderTest = moduleFixture.get(VacancyReportService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('formats the data of every source', async () => {
    reports.findAll.mockResolvedValue({ sources: [], vacancies: [], matches: [] });

    await expect(subjectUnderTest.build()).resolves.toBe('No sources. Add career pages to the sources table.\n');
    expect(reports.findAll).toHaveBeenCalledWith({});
  });

  it('reads one source when asked', async () => {
    reports.findAll.mockResolvedValue({ sources: [], vacancies: [], matches: [] });

    await subjectUnderTest.build({ sourceIds: [2] });

    expect(reports.findAll).toHaveBeenCalledWith({ sourceIds: [2] });
  });

  it('passes a failed read on', async () => {
    reports.findAll.mockRejectedValue(new Error('connection refused'));

    await expect(subjectUnderTest.build()).rejects.toThrow('connection refused');
  });
});
