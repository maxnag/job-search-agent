import { describe, expect, it } from 'vitest';

import { RoleFamilyEnum, SeniorityLevelEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import type { VacancyRowType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import { ListingGapEnum } from '../enums/listing-gap.enum.js';
import type { IListingScanRequest } from '../interfaces/listing-scan-request.interface.js';
import type { IScreenedPosition } from '../interfaces/screened-position.interface.js';
import { planListingScan } from './listing-scan.helper.js';

const NOW = new Date('2026-11-23T10:00:00Z');
const RECHECK_BEFORE = new Date('2026-11-22T10:00:00Z');

/**
 * A position on the listing page
 *
 * @param {Partial<IScreenedPosition>} changes
 *
 * @returns {IScreenedPosition}
 */
function position(changes: Partial<IScreenedPosition> = {}): IScreenedPosition {
  return {
    url: 'https://careers.example.com/jobs/1',
    title: 'Backend Developer',
    company: 'Northwind',
    country: 'IL',
    city: 'Haifa',
    workMode: WorkModeEnum.HYBRID,
    roleFamily: RoleFamilyEnum.BACKEND,
    level: SeniorityLevelEnum.SENIOR,
    ...changes
  };
}

/**
 * A stored vacancy
 *
 * @param {Partial<VacancyRowType>} changes
 *
 * @returns {VacancyRowType}
 */
function row(changes: Partial<VacancyRowType> = {}): VacancyRowType {
  return {
    vacancy_id: 7,
    source_id: 1,
    vacancy_url: 'https://careers.example.com/jobs/1',
    vacancy_external_id: null,
    vacancy_title: 'Backend Developer',
    vacancy_company: 'Northwind',
    vacancy_dedup_key: 'northwind|backend developer',
    vacancy_dedup_country: 'IL',
    vacancy_country: 'IL',
    vacancy_city: 'Haifa',
    vacancy_work_mode: WorkModeEnum.HYBRID,
    vacancy_role_family: RoleFamilyEnum.BACKEND,
    vacancy_level: SeniorityLevelEnum.SENIOR,
    vacancy_stage: VacancyStageEnum.LISTED,
    vacancy_skip_reason: null,
    vacancy_text_hash: null,
    vacancy_data: null,
    vacancy_first_seen_at: new Date('2026-11-01T00:00:00Z'),
    vacancy_last_seen_at: new Date('2026-11-01T00:00:00Z'),
    vacancy_closed_at: null,
    vacancy_checked_at: null,
    vacancy_text_url: null,
    vacancy_text_searched_at: null,
    vacancy_text_searches: 0,
    dt_create: new Date('2026-11-01T00:00:00Z'),
    dt_update: null,
    ...changes
  };
}

/**
 * A scan request of a whole listing with the given positions and stored rows
 *
 * @param {IScreenedPosition[]} positions
 * @param {VacancyRowType[]} known
 * @param {VacancyRowType[]} open
 *
 * @returns {IListingScanRequest}
 */
function request(positions: IScreenedPosition[], known: VacancyRowType[] = [], open: VacancyRowType[] = known): IListingScanRequest {
  return { sourceId: 1, positions, gaps: [], known, open, now: NOW, recheckBefore: RECHECK_BEFORE };
}

describe('planListingScan', () => {
  it('inserts a new position as listed, with its dedup key and the listing columns', () => {
    const plan = planListingScan(request([position()]));

    expect(plan.inserts).toEqual([
      {
        source_id: 1,
        vacancy_url: 'https://careers.example.com/jobs/1',
        vacancy_external_id: null,
        vacancy_title: 'Backend Developer',
        vacancy_company: 'Northwind',
        vacancy_dedup_key: 'northwind|backend developer',
        vacancy_dedup_country: 'IL',
        vacancy_country: 'IL',
        vacancy_city: 'Haifa',
        vacancy_work_mode: WorkModeEnum.HYBRID,
        vacancy_role_family: RoleFamilyEnum.BACKEND,
        vacancy_level: SeniorityLevelEnum.SENIOR,
        vacancy_skip_reason: null,
        vacancy_stage: VacancyStageEnum.LISTED,
        vacancy_first_seen_at: NOW,
        vacancy_last_seen_at: NOW
      }
    ]);
    expect(plan).toMatchObject({ updates: [], closeIds: [], recheckIds: [] });
  });

  it('inserts a position the filter dropped as skipped, with the reason', () => {
    const [insert] = planListingScan(request([position({ skipReason: 'role qa is not searched' })])).inserts;

    expect(insert).toMatchObject({ vacancy_stage: VacancyStageEnum.SKIPPED, vacancy_skip_reason: 'role qa is not searched' });
  });

  it('inserts one row for the same position listed twice under different URLs', () => {
    const plan = planListingScan(
      request([position(), position({ url: 'https://careers.example.com/jobs/1?city=haifa', company: 'NORTHWIND LTD' })])
    );

    expect(plan.inserts).toHaveLength(1);
  });

  it('finds a known vacancy by URL and refreshes a not extracted one from the listing', () => {
    const plan = planListingScan(request([position({ city: 'Tel Aviv', skipReason: 'city excluded' })], [row()]));

    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([
      {
        vacancyId: 7,
        values: {
          vacancy_last_seen_at: NOW,
          vacancy_country: 'IL',
          vacancy_city: 'Tel Aviv',
          vacancy_work_mode: WorkModeEnum.HYBRID,
          vacancy_role_family: RoleFamilyEnum.BACKEND,
          vacancy_level: SeniorityLevelEnum.SENIOR,
          vacancy_skip_reason: 'city excluded',
          vacancy_stage: VacancyStageEnum.SKIPPED,
          vacancy_closed_at: null
        }
      }
    ]);
  });

  it('finds a known vacancy by its dedup key when the URL changed', () => {
    const plan = planListingScan(request([position({ url: 'https://careers.example.com/jobs/1-new' })], [row()]));

    expect(plan.inserts).toEqual([]);
    expect(plan.updates.map(update => update.vacancyId)).toEqual([7]);
  });

  it('only marks an extracted vacancy as seen — the listing does not overwrite its extraction', () => {
    const extracted = row({ vacancy_stage: VacancyStageEnum.EXTRACTED, vacancy_data: { title: 'x' }, vacancy_checked_at: NOW });
    const plan = planListingScan(request([position({ city: 'Eilat' })], [extracted]));

    expect(plan.updates).toEqual([{ vacancyId: 7, values: { vacancy_last_seen_at: NOW } }]);
  });

  it('reopens an extracted vacancy that was closed and is back on the page', () => {
    const closed = row({
      vacancy_stage: VacancyStageEnum.CLOSED,
      vacancy_data: { title: 'x' },
      vacancy_checked_at: NOW,
      vacancy_closed_at: NOW
    });
    const plan = planListingScan(request([position()], [closed], []));

    expect(plan.updates).toEqual([
      { vacancyId: 7, values: { vacancy_last_seen_at: NOW, vacancy_stage: VacancyStageEnum.EXTRACTED, vacancy_closed_at: null } }
    ]);
  });

  it('reopens a closed vacancy never extracted as listed', () => {
    const closed = row({ vacancy_stage: VacancyStageEnum.CLOSED, vacancy_closed_at: NOW });
    const [update] = planListingScan(request([position()], [closed], [])).updates;

    expect(update?.values).toMatchObject({ vacancy_stage: VacancyStageEnum.LISTED, vacancy_closed_at: null });
  });

  it('updates a known vacancy once when it is listed twice', () => {
    const plan = planListingScan(request([position(), position({ url: 'https://careers.example.com/jobs/1?ref=2' })], [row()]));

    expect(plan.updates).toHaveLength(1);
    expect(plan.inserts).toEqual([]);
  });

  it('closes an open vacancy gone from the page', () => {
    const gone = row({
      vacancy_id: 8,
      vacancy_url: 'https://careers.example.com/jobs/2',
      vacancy_dedup_key: 'northwind|frontend developer'
    });
    const plan = planListingScan(request([position()], [row(), gone]));

    expect(plan.closeIds).toEqual([8]);
  });

  it('closes nothing when the page yielded no position — an empty answer is not an empty list', () => {
    expect(planListingScan(request([], [row()])).closeIds).toEqual([]);
  });

  it.each([
    ['never checked', null],
    ['checked before the recheck time', new Date('2026-11-21T10:00:00Z')]
  ])('queues an extracted vacancy %s for a recheck', (_case, checkedAt) => {
    const extracted = row({ vacancy_stage: VacancyStageEnum.EXTRACTED, vacancy_data: { title: 'x' }, vacancy_checked_at: checkedAt });

    expect(planListingScan(request([position()], [extracted])).recheckIds).toEqual([7]);
  });

  it.each([
    ['checked at the recheck time', RECHECK_BEFORE],
    ['checked after it', NOW]
  ])('does not recheck an extracted vacancy %s', (_case, checkedAt) => {
    const extracted = row({ vacancy_stage: VacancyStageEnum.EXTRACTED, vacancy_data: { title: 'x' }, vacancy_checked_at: checkedAt });

    expect(planListingScan(request([position()], [extracted])).recheckIds).toEqual([]);
  });

  it('never rechecks a vacancy that was not extracted', () => {
    expect(planListingScan(request([position()], [row()])).recheckIds).toEqual([]);
  });

  describe('an incomplete listing', () => {
    const goneExtracted = (changes: Partial<VacancyRowType> = {}): VacancyRowType =>
      row({
        vacancy_id: 8,
        vacancy_url: 'https://careers.example.com/jobs/2',
        vacancy_dedup_key: 'northwind|frontend developer',
        vacancy_stage: VacancyStageEnum.EXTRACTED,
        vacancy_data: { title: 'Frontend Developer' },
        ...changes
      });

    it.each([ListingGapEnum.PAGINATION, ListingGapEnum.LINK_LIMIT, ListingGapEnum.SCROLL_LIMIT])('closes nothing with the %s gap', gap => {
      const plan = planListingScan({ ...request([position()], [row()], [row(), goneExtracted()]), gaps: [gap] });

      expect(plan.closeIds).toEqual([]);
    });

    it('rechecks an extracted vacancy not on the listing when it is due — its page decides whether it is closed', () => {
      const plan = planListingScan({ ...request([position()], [row()], [row(), goneExtracted()]), gaps: [ListingGapEnum.PAGINATION] });

      expect(plan.recheckIds).toEqual([8]);
    });

    it('does not recheck an extracted vacancy not on the listing that was read after the recheck time', () => {
      const plan = planListingScan({
        ...request([position()], [row()], [row(), goneExtracted({ vacancy_checked_at: NOW })]),
        gaps: [ListingGapEnum.PAGINATION]
      });

      expect(plan.recheckIds).toEqual([]);
    });

    it('leaves a vacancy not on the listing and never extracted alone', () => {
      const listed = row({ vacancy_id: 9, vacancy_url: 'https://careers.example.com/jobs/3', vacancy_dedup_key: 'northwind|qa engineer' });
      const plan = planListingScan({ ...request([position()], [row()], [row(), listed]), gaps: [ListingGapEnum.PAGINATION] });

      expect(plan).toMatchObject({ closeIds: [], recheckIds: [] });
    });

    it('still writes the positions it saw', () => {
      const plan = planListingScan({ ...request([position()]), gaps: [ListingGapEnum.PAGINATION] });

      expect(plan.inserts).toHaveLength(1);
    });
  });
});
