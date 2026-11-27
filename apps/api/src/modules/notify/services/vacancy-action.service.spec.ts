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
    expect(notifications.createMessage).toHaveBeenCalledWith(7, 555);
  });

  it('stores a choice made outside Telegram without a message', async () => {
    await subjectUnderTest.record(7, VacancyActionKindEnum.APPLIED);

    expect(notifications.createAction).toHaveBeenCalledWith(7, VacancyActionKindEnum.APPLIED, undefined);
    expect(notifications.createMessage).not.toHaveBeenCalled();
  });

  it.each([
    ['a new choice is stored', true],
    ['a repeat of the latest choice is not', false]
  ])('answers whether %s', async (_case, stored) => {
    notifications.createAction.mockResolvedValue(stored);

    await expect(subjectUnderTest.record(7, VacancyActionKindEnum.APPLIED)).resolves.toBe(stored);
  });

  it('passes a failed write on', async () => {
    notifications.createAction.mockRejectedValue(new Error('foreign key violation'));

    await expect(subjectUnderTest.record(7, VacancyActionKindEnum.SKIPPED, 555)).rejects.toThrow('foreign key violation');
  });
});
