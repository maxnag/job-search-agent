import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { truncateTables, vacancyActions, vacancyMatches } from '@job-agent/db';
import { SourceStatusEnum, VacancyActionKindEnum, VacancyMatchVerdictEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import {
  PIPELINE_TABLES,
  insertMatch,
  insertProfileWithResume,
  insertResume,
  insertSource,
  insertVacancy
} from '../../../../test/vacancy-fixtures.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { MatchRuleEnum } from '../../matching/enums/match-rule.enum.js';
import { NotificationRepository } from './notification.repository.js';

const REASONS = [{ rule: MatchRuleEnum.LANGUAGES, effect: VacancyMatchVerdictEnum.FIT, message: 'matches TypeScript' }];

describe('NotificationRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: NotificationRepository;
  let database: DatabaseService;
  let sourceId: number;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [NotificationRepository, testDatabaseProvider()] }).compile();
    repository = moduleFixture.get(NotificationRepository);
    database = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(database.db, PIPELINE_TABLES);
    sourceId = (await insertSource(database, { source_name: 'Northwind', source_url: 'https://careers.example.com/jobs' })).source_id;
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('reads a match card with the vacancy, the verdict and whether its resume is current', async () => {
    const { resumeId } = await insertProfileWithResume(database, 'developer');
    const vacancy = await insertVacancy(database, sourceId, {
      vacancy_stage: VacancyStageEnum.EXTRACTED,
      vacancy_city: 'Haifa',
      vacancy_country: 'IL',
      vacancy_work_mode: WorkModeEnum.HYBRID
    });
    const matchId = await insertMatch(database, vacancy.vacancy_id, resumeId, { vacancy_match_reasons: REASONS });

    await expect(repository.findMatchCard(matchId)).resolves.toEqual({
      vacancyId: vacancy.vacancy_id,
      title: 'Backend Developer',
      company: 'Northwind',
      city: 'Haifa',
      country: 'IL',
      workMode: WorkModeEnum.HYBRID,
      url: vacancy.vacancy_url,
      textURL: null,
      stage: VacancyStageEnum.EXTRACTED,
      vacancyMatchId: matchId,
      verdict: VacancyMatchVerdictEnum.FIT,
      reasons: REASONS,
      notifiedAt: null,
      isCurrentResume: true
    });
    await expect(repository.findMatchCard(999)).resolves.toBeUndefined();
  });

  describe('findVacancyNotice', () => {
    it('takes the verdict of the current resume, not of an older one', async () => {
      const { profileId, resumeId: older } = await insertProfileWithResume(database, 'developer', { isCurrent: false });
      const current = await insertResume(database, profileId);
      const vacancy = await insertVacancy(database, sourceId);

      await insertMatch(database, vacancy.vacancy_id, current, { vacancy_match_verdict: VacancyMatchVerdictEnum.ALMOST });
      await insertMatch(database, vacancy.vacancy_id, older, { vacancy_match_verdict: VacancyMatchVerdictEnum.FIT });

      await expect(repository.findVacancyNotice(vacancy.vacancy_id)).resolves.toMatchObject({ verdict: VacancyMatchVerdictEnum.ALMOST });
    });

    it('carries the posting on the company board of a vacancy from an e-mail', async () => {
      const vacancy = await insertVacancy(database, sourceId, { vacancy_text_url: 'https://jobs.lever.co/northwind/a1' });

      await expect(repository.findVacancyNotice(vacancy.vacancy_id)).resolves.toMatchObject({
        textURL: 'https://jobs.lever.co/northwind/a1'
      });
    });

    it('gives a vacancy never matched without a verdict and with no findings', async () => {
      const vacancy = await insertVacancy(database, sourceId);

      await expect(repository.findVacancyNotice(vacancy.vacancy_id)).resolves.toMatchObject({ verdict: null, reasons: [] });
      await expect(repository.findVacancyNotice(999)).resolves.toBeUndefined();
    });
  });

  it('lists the cards never sent: fit or almost, current resume, extracted vacancy', async () => {
    const { profileId, resumeId: older } = await insertProfileWithResume(database, 'developer', { isCurrent: false });
    const current = await insertResume(database, profileId);
    const extracted = (index: number) =>
      insertVacancy(database, sourceId, { vacancy_stage: VacancyStageEnum.EXTRACTED, vacancy_title: `Job ${index}` });
    const fit = await insertMatch(database, (await extracted(1)).vacancy_id, current);
    const almost = await insertMatch(database, (await extracted(2)).vacancy_id, current, {
      vacancy_match_verdict: VacancyMatchVerdictEnum.ALMOST
    });

    await insertMatch(database, (await extracted(3)).vacancy_id, current, { vacancy_match_verdict: VacancyMatchVerdictEnum.NO_FIT });
    await insertMatch(database, (await extracted(4)).vacancy_id, current, { vacancy_match_notified_at: new Date() });
    await insertMatch(database, (await extracted(5)).vacancy_id, older);
    await insertMatch(database, (await insertVacancy(database, sourceId, { vacancy_stage: VacancyStageEnum.CLOSED })).vacancy_id, current);

    await expect(repository.findPendingMatchIds()).resolves.toEqual([fit, almost]);
  });

  it('marks a card as sent now', async () => {
    const { resumeId } = await insertProfileWithResume(database, 'developer');
    const matchId = await insertMatch(database, (await insertVacancy(database, sourceId)).vacancy_id, resumeId);

    await repository.markNotified(matchId);

    const [row] = await database.db.select().from(vacancyMatches);

    expect(row?.vacancy_match_notified_at).toBeInstanceOf(Date);
  });

  it('reads the notice of a stopped source', async () => {
    const blocked = await insertSource(database, {
      source_name: 'Contoso',
      source_status: SourceStatusEnum.BLOCKED,
      source_last_error: 'HTTP 403'
    });

    await expect(repository.findSourceNotice(blocked.source_id)).resolves.toEqual({
      name: 'Contoso',
      url: blocked.source_url,
      status: SourceStatusEnum.BLOCKED,
      error: 'HTTP 403'
    });
    await expect(repository.findSourceNotice(999)).resolves.toBeUndefined();
  });

  it('stores every button press, the history kept', async () => {
    const vacancy = await insertVacancy(database, sourceId);

    await repository.createAction(vacancy.vacancy_id, VacancyActionKindEnum.INTERESTED, 555);
    await repository.createAction(vacancy.vacancy_id, VacancyActionKindEnum.APPLIED, 555);

    const rows = await database.db.select().from(vacancyActions);

    expect(rows.map(row => [row.vacancy_id, row.vacancy_action_kind, row.vacancy_action_message_id])).toEqual([
      [vacancy.vacancy_id, VacancyActionKindEnum.INTERESTED, 555],
      [vacancy.vacancy_id, VacancyActionKindEnum.APPLIED, 555]
    ]);
  });

  it('stores a choice made outside Telegram without a message', async () => {
    const vacancy = await insertVacancy(database, sourceId);

    await repository.createAction(vacancy.vacancy_id, VacancyActionKindEnum.APPLIED);

    const rows = await database.db.select().from(vacancyActions);

    expect(rows.map(row => [row.vacancy_id, row.vacancy_action_kind, row.vacancy_action_message_id])).toEqual([
      [vacancy.vacancy_id, VacancyActionKindEnum.APPLIED, null]
    ]);
  });

  it('refuses a press on a vacancy that does not exist', async () => {
    await expect(repository.createAction(999, VacancyActionKindEnum.SKIPPED, 555)).rejects.toThrow();
  });

  describe('the messages that carry the buttons of a vacancy', () => {
    it('remembers each message once and lists them oldest first', async () => {
      const vacancy = await insertVacancy(database, sourceId);
      const other = await insertVacancy(database, sourceId);

      await repository.createMessage(vacancy.vacancy_id, 556);
      await repository.createMessage(vacancy.vacancy_id, 555);
      await repository.createMessage(vacancy.vacancy_id, 556);
      await repository.createMessage(other.vacancy_id, 700);

      await expect(repository.findMessageIds(vacancy.vacancy_id)).resolves.toEqual([556, 555]);
      await expect(repository.findMessageIds(999)).resolves.toEqual([]);
    });

    it('forgets one message of one vacancy', async () => {
      const vacancy = await insertVacancy(database, sourceId);
      const other = await insertVacancy(database, sourceId);

      await repository.createMessage(vacancy.vacancy_id, 555);
      await repository.createMessage(vacancy.vacancy_id, 556);
      await repository.createMessage(other.vacancy_id, 555);
      await repository.deleteMessage(vacancy.vacancy_id, 555);

      await expect(repository.findMessageIds(vacancy.vacancy_id)).resolves.toEqual([556]);
      await expect(repository.findMessageIds(other.vacancy_id)).resolves.toEqual([555]);
    });
  });

  describe('choices not synced yet', () => {
    it('lists the latest choice of each vacancy that has an unsynced one', async () => {
      const first = await insertVacancy(database, sourceId);
      const second = await insertVacancy(database, sourceId);
      const synced = await insertVacancy(database, sourceId);

      await repository.createAction(first.vacancy_id, VacancyActionKindEnum.SKIPPED);
      await repository.createAction(first.vacancy_id, VacancyActionKindEnum.INTERESTED);
      await repository.createAction(second.vacancy_id, VacancyActionKindEnum.APPLIED, 555);
      await repository.createAction(synced.vacancy_id, VacancyActionKindEnum.APPLIED);
      await database.db
        .update(vacancyActions)
        .set({ vacancy_action_synced_at: new Date() })
        .where(eq(vacancyActions.vacancy_id, synced.vacancy_id));

      const unsynced = await repository.findUnsyncedActions();

      expect(unsynced.map(action => [action.vacancyId, action.kind])).toEqual([
        [first.vacancy_id, VacancyActionKindEnum.INTERESTED],
        [second.vacancy_id, VacancyActionKindEnum.APPLIED]
      ]);
      await expect(repository.findUnsyncedActions(second.vacancy_id)).resolves.toEqual([
        expect.objectContaining({ vacancyId: second.vacancy_id, kind: VacancyActionKindEnum.APPLIED })
      ]);
    });

    it('marks the choices up to the given one synced, a later one left waiting', async () => {
      const vacancy = await insertVacancy(database, sourceId);

      await repository.createAction(vacancy.vacancy_id, VacancyActionKindEnum.SKIPPED);
      await repository.createAction(vacancy.vacancy_id, VacancyActionKindEnum.INTERESTED);

      const [latest] = await repository.findUnsyncedActions(vacancy.vacancy_id);

      await repository.createAction(vacancy.vacancy_id, VacancyActionKindEnum.APPLIED);
      await repository.markActionsSynced(vacancy.vacancy_id, latest?.vacancyActionId ?? 0);

      const rows = await database.db.select().from(vacancyActions).orderBy(vacancyActions.vacancy_action_id);

      expect(rows.map(row => [row.vacancy_action_kind, row.vacancy_action_synced_at !== null])).toEqual([
        [VacancyActionKindEnum.SKIPPED, true],
        [VacancyActionKindEnum.INTERESTED, true],
        [VacancyActionKindEnum.APPLIED, false]
      ]);
      await expect(repository.findUnsyncedActions(vacancy.vacancy_id)).resolves.toEqual([
        expect.objectContaining({ kind: VacancyActionKindEnum.APPLIED })
      ]);
    });
  });
});
