import { readFile } from 'node:fs/promises';

import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LLMStepEnum, RoleFamilyEnum, SeniorityLevelEnum, WorkModeEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import type { IFetchedPage } from '../../crawler/interfaces/fetched-page.interface.js';
import { LLMClient } from '../../llm/clients/l-l-m.client.js';
import { type VacancyListingType, vacancyListingSchema } from '../schemas/vacancy-listing.schema.js';
import { ListingExtractionService } from './listing-extraction.service.js';

const PROMPT_URL = new URL('../prompts/vacancy-listing.md', import.meta.url);

const PAGE: IFetchedPage = {
  url: 'https://careers.example.com/jobs',
  status: 200,
  headers: {},
  html: '<ul><li><a href="/jobs/1">Senior Backend Developer</a></li><li><a href="/jobs/2">QA Engineer</a></li><li><a href="/about">About</a></li></ul>'
};

/**
 * A position of the LLM answer
 *
 * @param {Partial<VacancyListingType['positions'][number]>} changes
 *
 * @returns {VacancyListingType['positions'][number]}
 */
function listed(changes: Partial<VacancyListingType['positions'][number]> = {}): VacancyListingType['positions'][number] {
  return {
    link: 0,
    title: 'Senior Backend Developer',
    company: null,
    country: 'il',
    city: 'Haifa',
    work_mode: WorkModeEnum.HYBRID,
    role_family: RoleFamilyEnum.BACKEND,
    level: SeniorityLevelEnum.SENIOR,
    ...changes
  };
}

describe('ListingExtractionService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: ListingExtractionService;
  let llm: DeepMocked<LLMClient>;

  beforeEach(async () => {
    llm = createMock<LLMClient>();
    moduleFixture = await Test.createTestingModule({
      providers: [
        ListingExtractionService,
        { provide: LLMClient, useValue: llm },
        { provide: ConfigService, useValue: createConfigMock({ LISTING_MAX_LINKS: 100, LISTING_BATCH_SIZE: 100 }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(ListingExtractionService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('asks the listing step with the numbered links fenced as data and maps the numbers back to URLs', async () => {
    llm.generateBySchema.mockResolvedValue({ data: { positions: [listed()] }, model: 'claude-haiku-5-5' });

    const result = await subjectUnderTest.extract(PAGE, 'Northwind');

    expect(result).toEqual({
      links: 3,
      positions: [
        {
          url: 'https://careers.example.com/jobs/1',
          title: 'Senior Backend Developer',
          company: 'Northwind',
          country: 'IL',
          city: 'Haifa',
          workMode: WorkModeEnum.HYBRID,
          roleFamily: RoleFamilyEnum.BACKEND,
          level: SeniorityLevelEnum.SENIOR
        }
      ]
    });

    const request = llm.generateBySchema.mock.calls[0]?.[0];

    expect(request).toMatchObject({ step: LLMStepEnum.LISTING, system: await readFile(PROMPT_URL, 'utf8'), schema: vacancyListingSchema });
    expect(request?.prompt).toMatch(/^<links>\nPage: https:\/\/careers\.example\.com\/jobs\nLinks:\n\[0\] text: Senior Backend Developer/);
    expect(request?.prompt.endsWith('\n</links>')).toBe(true);
  });

  it('costs no LLM call for a page without links', async () => {
    await expect(subjectUnderTest.extract({ ...PAGE, html: '<p>No openings</p>' }, 'Northwind')).resolves.toEqual({
      links: 0,
      positions: []
    });
    expect(llm.generateBySchema).not.toHaveBeenCalled();
  });

  it('keeps the company the page names for a posting', async () => {
    llm.generateBySchema.mockResolvedValue({ data: { positions: [listed({ company: ' Contoso ' })] }, model: 'm' });

    const { positions } = await subjectUnderTest.extract(PAGE, 'Job Board');

    expect(positions[0]?.company).toBe('Contoso');
  });

  it('ignores a number the page does not have and a link named twice', async () => {
    llm.generateBySchema.mockResolvedValue({
      data: {
        positions: [listed({ link: 9 }), listed({ link: 1, title: 'QA Engineer' }), listed({ link: 1, title: 'QA Engineer again' })]
      },
      model: 'm'
    });

    const { positions } = await subjectUnderTest.extract(PAGE, 'Northwind');

    expect(positions.map(position => position.title)).toEqual(['QA Engineer']);
  });

  it('clips fields a page planted too long', async () => {
    llm.generateBySchema.mockResolvedValue({
      data: { positions: [listed({ title: 't'.repeat(500), company: 'c'.repeat(500), city: 'k'.repeat(500) })] },
      model: 'm'
    });

    const [position] = (await subjectUnderTest.extract(PAGE, 'Northwind')).positions;

    expect([position?.title.length, position?.company.length, position?.city?.length]).toEqual([200, 120, 80]);
  });

  it('passes an invalid answer of the LLM on', async () => {
    llm.generateBySchema.mockRejectedValue(new Error('LLM_OUTPUT_SCHEMA_INVALID: positions'));

    await expect(subjectUnderTest.extract(PAGE, 'Northwind')).rejects.toThrow('LLM_OUTPUT_SCHEMA_INVALID');
  });

  it('keeps the bytes of the prompt (golden snapshot)', async () => {
    expect(await readFile(PROMPT_URL, 'utf8')).toMatchSnapshot();
  });
});
