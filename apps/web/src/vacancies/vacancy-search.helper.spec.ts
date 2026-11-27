import { describe, expect, it } from 'vitest';

import {
  SeniorityLevelEnum,
  SortOrderEnum,
  VacancyLastActionEnum,
  VacancyMatchVerdictEnum,
  VacancySortEnum,
  VacancyStageEnum,
  WorkModeEnum
} from '@job-agent/shared';

import { parseVacancySearch, toVacancyAPIQuery, toVacancyQuery } from './vacancy-search.helper';
import { VACANCY_SEARCH_DEFAULTS } from './vacancy-search.schema';

/**
 * The filters of an address with no query — the defaults
 */
const DEFAULTS = parseVacancySearch({});

describe('parseVacancySearch', () => {
  it('gives the defaults for an address without filters', () => {
    expect(DEFAULTS).toEqual({
      stage: [VacancyStageEnum.LISTED, VacancyStageEnum.EXTRACTED],
      verdict: [VacancyMatchVerdictEnum.FIT, VacancyMatchVerdictEnum.ALMOST],
      country: ['IL', 'UA'],
      level: [SeniorityLevelEnum.SENIOR, SeniorityLevelEnum.STAFF, SeniorityLevelEnum.PRINCIPAL],
      lastAction: [VacancyLastActionEnum.INTERESTED, VacancyLastActionEnum.APPLIED, VacancyLastActionEnum.NONE],
      sinceDays: 3,
      sort: VacancySortEnum.FIRST_SEEN_AT,
      order: SortOrderEnum.DESC,
      page: 1,
      pageSize: 25
    });
  });

  it('reads an empty value as "any", apart from the default', () => {
    expect(parseVacancySearch({ country: '', sinceDays: '', lastAction: '' })).toMatchObject({
      country: [],
      sinceDays: undefined,
      lastAction: []
    });
  });

  it('reads the filters of a record and of URLSearchParams alike, a country in upper case', () => {
    const query = new URLSearchParams('stage=closed&country=ua&country=il&level=junior&q=%20react%20&closed=true&page=3');

    expect(parseVacancySearch(query)).toMatchObject({
      stage: [VacancyStageEnum.CLOSED],
      country: ['UA', 'IL'],
      level: [SeniorityLevelEnum.JUNIOR],
      q: 'react',
      closed: true,
      page: 3
    });
    expect(parseVacancySearch({ stage: 'closed', country: ['ua', 'il'] })).toMatchObject({
      stage: [VacancyStageEnum.CLOSED],
      country: ['UA', 'IL']
    });
  });

  it.each([
    ['an unknown value of a list is dropped', { stage: ['listed', 'archived'] }, { stage: [VacancyStageEnum.LISTED] }],
    ['a period the list does not offer is "any"', { sinceDays: '5' }, { sinceDays: undefined }],
    ['a wrong page is the first', { page: '-2' }, { page: 1 }],
    ['a page size the list does not offer is the default', { pageSize: '30' }, { pageSize: 25 }],
    ['an unknown sort is the default', { sort: 'salary' }, { sort: VacancySortEnum.FIRST_SEEN_AT }],
    ['an unknown work mode is no filter', { workMode: 'office' }, { workMode: undefined }],
    ['an empty text is no filter', { q: '   ', city: '' }, { q: undefined, city: undefined }]
  ])('never breaks on a hand-edited link: %s', (_case, query, expected) => {
    expect(parseVacancySearch(query)).toMatchObject(expected);
  });
});

describe('toVacancyQuery', () => {
  it('writes nothing for the defaults', () => {
    expect(toVacancyQuery(DEFAULTS).toString()).toBe('');
  });

  it('writes an emptied list and period as an empty value, so they do not fall back to the defaults', () => {
    const query = toVacancyQuery({ ...DEFAULTS, country: [], sinceDays: undefined });

    expect(query.toString()).toBe('country=&sinceDays=');
    expect(parseVacancySearch(query)).toMatchObject({ country: [], sinceDays: undefined });
  });

  it('writes the default list in another order as the default', () => {
    expect(toVacancyQuery({ ...DEFAULTS, country: ['UA', 'IL'] }).toString()).toBe('');
  });

  it('writes every filter that differs, and reads back the same filters', () => {
    const search = {
      ...DEFAULTS,
      stage: [VacancyStageEnum.CLOSED],
      workMode: WorkModeEnum.REMOTE,
      sourceId: 3,
      city: 'Tel Aviv',
      company: 'Northwind',
      closed: true as const,
      sort: VacancySortEnum.TITLE,
      order: SortOrderEnum.ASC,
      page: 2,
      pageSize: 50
    };
    const query = toVacancyQuery(search);

    expect(query.toString()).toBe(
      'stage=closed&sourceId=3&city=Tel+Aviv&workMode=remote&company=Northwind&closed=true&sort=title&order=asc&page=2&pageSize=50'
    );
    expect(parseVacancySearch(query)).toEqual(search);
  });
});

describe('toVacancyAPIQuery', () => {
  it('writes every filter in force, the defaults included, as the API knows no defaults of the page', () => {
    const query = toVacancyAPIQuery(DEFAULTS);

    expect(query.getAll('stage')).toEqual([...VACANCY_SEARCH_DEFAULTS.stage]);
    expect(query.getAll('country')).toEqual(['IL', 'UA']);
    expect(query.getAll('lastAction')).toEqual([...VACANCY_SEARCH_DEFAULTS.lastAction]);
    expect(query.get('sinceDays')).toBe('3');
    expect(query.get('sort')).toBe('firstSeenAt');
    expect(query.get('page')).toBe('1');
    expect(query.get('pageSize')).toBe('25');
  });

  it('writes nothing for a filter set to any', () => {
    const query = toVacancyAPIQuery({ ...DEFAULTS, country: [], sinceDays: undefined });

    expect(query.has('country')).toBe(false);
    expect(query.has('sinceDays')).toBe(false);
  });
});
