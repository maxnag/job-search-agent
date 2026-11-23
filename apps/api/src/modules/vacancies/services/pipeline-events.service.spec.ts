import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { JobNameEnum, QueueNameEnum } from '@job-agent/shared';

import { VacancyRepository } from '../repositories/vacancy.repository.js';
import { PipelineEventsService } from './pipeline-events.service.js';

describe('PipelineEventsService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: PipelineEventsService;
  let vacancies: DeepMocked<VacancyRepository>;
  let extractQueue: DeepMocked<Queue>;
  let notifyQueue: DeepMocked<Queue>;

  beforeEach(async () => {
    vacancies = createMock<VacancyRepository>();
    extractQueue = createMock<Queue>();
    notifyQueue = createMock<Queue>();
    moduleFixture = await Test.createTestingModule({
      providers: [
        PipelineEventsService,
        { provide: VacancyRepository, useValue: vacancies },
        { provide: getQueueToken(QueueNameEnum.EXTRACT), useValue: extractQueue },
        { provide: getQueueToken(QueueNameEnum.NOTIFY), useValue: notifyQueue }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(PipelineEventsService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('queues one deduplicated extraction per vacancy', async () => {
    await subjectUnderTest.queueExtraction([7, 8]);

    expect(extractQueue.add.mock.calls).toEqual([
      [JobNameEnum.EXTRACT_VACANCY, { vacancyId: 7 }, { deduplication: { id: `${JobNameEnum.EXTRACT_VACANCY}:7` } }],
      [JobNameEnum.EXTRACT_VACANCY, { vacancyId: 8 }, { deduplication: { id: `${JobNameEnum.EXTRACT_VACANCY}:8` } }]
    ]);
  });

  it('queues nothing for no vacancy', async () => {
    await subjectUnderTest.queueExtraction([]);
    await subjectUnderTest.vacanciesMatched([]);

    expect(extractQueue.add).not.toHaveBeenCalled();
    expect(notifyQueue.add).not.toHaveBeenCalled();
  });

  it('queues one deduplicated card per new match', async () => {
    await subjectUnderTest.vacanciesMatched([31]);

    expect(notifyQueue.add).toHaveBeenCalledWith(
      JobNameEnum.VACANCY_MATCHED,
      { vacancyMatchId: 31 },
      {
        deduplication: { id: `${JobNameEnum.VACANCY_MATCHED}:31` }
      }
    );
  });

  it('tells about closed vacancies only the ones the owner got a card for', async () => {
    vacancies.findNotifiedIds.mockResolvedValue([8]);

    await subjectUnderTest.vacanciesClosed([7, 8]);

    expect(vacancies.findNotifiedIds).toHaveBeenCalledWith([7, 8]);
    expect(notifyQueue.add.mock.calls).toEqual([[JobNameEnum.VACANCY_CLOSED, { vacancyId: 8 }]]);
  });

  it('tells about a changed vacancy the owner got a card for', async () => {
    vacancies.findNotifiedIds.mockResolvedValue([7]);

    await subjectUnderTest.vacancyChanged(7);

    expect(notifyQueue.add).toHaveBeenCalledWith(JobNameEnum.VACANCY_CHANGED, { vacancyId: 7 });
  });

  it('keeps quiet about a changed vacancy the owner never saw', async () => {
    vacancies.findNotifiedIds.mockResolvedValue([]);

    await subjectUnderTest.vacancyChanged(7);

    expect(notifyQueue.add).not.toHaveBeenCalled();
  });

  it('tells about a stopped source', async () => {
    await subjectUnderTest.sourceBlocked(1);

    expect(notifyQueue.add).toHaveBeenCalledWith(JobNameEnum.SOURCE_BLOCKED, { sourceId: 1 });
  });
});
