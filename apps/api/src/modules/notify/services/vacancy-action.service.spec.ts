import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VacancyActionKindEnum } from '@job-agent/shared';

import { NotificationRepository } from '../repositories/notification.repository.js';
import { VacancyActionService } from './vacancy-action.service.js';

describe('VacancyActionService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: VacancyActionService;
  let notifications: DeepMocked<NotificationRepository>;

  beforeEach(async () => {
    notifications = createMock<NotificationRepository>();
    moduleFixture = await Test.createTestingModule({
      providers: [VacancyActionService, { provide: NotificationRepository, useValue: notifications }]
    }).compile();

    subjectUnderTest = moduleFixture.get(VacancyActionService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('stores the press of a button with the message it came from', async () => {
    await subjectUnderTest.record(7, VacancyActionKindEnum.INTERESTED, 555);

    expect(notifications.createAction).toHaveBeenCalledWith(7, VacancyActionKindEnum.INTERESTED, 555);
  });

  it('passes a failed write on', async () => {
    notifications.createAction.mockRejectedValue(new Error('foreign key violation'));

    await expect(subjectUnderTest.record(7, VacancyActionKindEnum.SKIPPED, 555)).rejects.toThrow('foreign key violation');
  });
});
