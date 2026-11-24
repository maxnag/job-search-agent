import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ATSKindEnum, WorkModeEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import type { IATSPosition } from '../../ats/interfaces/a-t-s-client.interface.js';
import { ATSListingService } from '../../search/services/a-t-s-listing.service.js';
import { vacancyDedupKey } from '../../vacancies/helpers/vacancy-key.helper.js';
import type { VacancyRowType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import { BraveSearchClient } from '../clients/brave-search.client.js';
import { CompanyPostingService } from './company-posting.service.js';

/**
 * A vacancy seen in a LinkedIn alert
 *
 * @type {VacancyRowType}
 */
const VACANCY = {
  vacancy_id: 7,
  vacancy_url: 'https://www.linkedin.com/jobs/view/4100000001/',
  vacancy_company: 'Northwind Ltd',
  vacancy_dedup_key: vacancyDedupKey('Northwind Ltd', 'Backend Engineer'),
  vacancy_country: 'IL'
} as VacancyRowType;

/**
 * A position of a board
 *
 * @param {string} title
 * @param {Partial<IATSPosition>} changes
 *
 * @returns {IATSPosition}
 */
function position(title: string, changes: Partial<IATSPosition> = {}): IATSPosition {
  return {
    externalId: `id-${title}`,
    url: `https://job-boards.greenhouse.io/northwind/jobs/${title.length}`,
    title,
    country: 'IL',
    city: 'Haifa',
    workMode: WorkModeEnum.HYBRID,
    location: 'Haifa',
    department: null,
    ...changes
  };
}

describe('CompanyPostingService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: CompanyPostingService;
  let brave: DeepMocked<BraveSearchClient>;
  let listings: DeepMocked<ATSListingService>;

  beforeEach(async () => {
    brave = createMock<BraveSearchClient>();
    listings = createMock<ATSListingService>();
    brave.isEnabled.mockReturnValue(true);
    brave.search.mockResolvedValue([]);
    moduleFixture = await Test.createTestingModule({
      providers: [
        CompanyPostingService,
        { provide: BraveSearchClient, useValue: brave },
        { provide: ATSListingService, useValue: listings },
        { provide: ConfigService, useValue: createConfigMock({ DISCOVER_BOARD_TIMEOUT_MS: 8000 }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(CompanyPostingService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('isEnabled follows the key of the web search', () => {
    expect(subjectUnderTest.isEnabled()).toBe(true);

    brave.isEnabled.mockReturnValue(false);

    expect(subjectUnderTest.isEnabled()).toBe(false);
  });

  describe('find', () => {
    it('finds the same position of the same company on its ATS board', async () => {
      brave.search.mockResolvedValueOnce([]).mockResolvedValueOnce(['https://job-boards.greenhouse.io/northwind/jobs/1']);
      listings.fetchBoard.mockResolvedValue({ company: 'Northwind', positions: [position('Data Engineer'), position('Backend Engineer')] });

      await expect(subjectUnderTest.find(VACANCY)).resolves.toEqual({
        url: 'https://job-boards.greenhouse.io/northwind/jobs/16',
        externalId: 'id-Backend Engineer'
      });
      expect(brave.search).toHaveBeenCalledWith('site:comeet.com/jobs "Northwind Ltd"');
      expect(brave.search).toHaveBeenCalledWith('site:job-boards.greenhouse.io "Northwind Ltd"');
      expect(listings.fetchBoard).toHaveBeenCalledWith({ kind: ATSKindEnum.GREENHOUSE, board: 'northwind' }, 8000);
    });

    it('takes the board name as the company when the board does not name it', async () => {
      brave.search.mockResolvedValue(['https://jobs.lever.co/Northwind/a1']);
      listings.fetchBoard.mockResolvedValue({ company: null, positions: [position('Backend Engineer')] });

      await expect(subjectUnderTest.find(VACANCY)).resolves.toMatchObject({ externalId: 'id-Backend Engineer' });
    });

    it('skips the board of another company that only mentions this one', async () => {
      brave.search.mockResolvedValue(['https://job-boards.greenhouse.io/contoso/jobs/1']);
      listings.fetchBoard.mockResolvedValue({ company: 'Contoso', positions: [position('Backend Engineer')] });

      await expect(subjectUnderTest.find(VACANCY)).resolves.toBeUndefined();
    });

    it('skips a position of another title or another country', async () => {
      brave.search.mockResolvedValue(['https://job-boards.greenhouse.io/northwind/jobs/1']);
      listings.fetchBoard.mockResolvedValue({
        company: 'Northwind',
        positions: [position('Backend Engineer II'), position('Backend Engineer', { country: 'UA' })]
      });

      await expect(subjectUnderTest.find(VACANCY)).resolves.toBeUndefined();
    });

    it('accepts a position without a country', async () => {
      brave.search.mockResolvedValue(['https://job-boards.greenhouse.io/northwind/jobs/1']);
      listings.fetchBoard.mockResolvedValue({ company: 'Northwind', positions: [position('Backend Engineer', { country: null })] });

      await expect(subjectUnderTest.find(VACANCY)).resolves.toBeDefined();
    });

    it('reads at most three boards and stops searching once it has them', async () => {
      brave.search.mockResolvedValue([
        'https://job-boards.greenhouse.io/a/jobs/1',
        'https://job-boards.greenhouse.io/b/jobs/1',
        'https://job-boards.greenhouse.io/c/jobs/1',
        'https://job-boards.greenhouse.io/d/jobs/1',
        'https://careers.example.com/jobs/1'
      ]);
      listings.fetchBoard.mockResolvedValue({ company: 'Other', positions: [] });

      await expect(subjectUnderTest.find(VACANCY)).resolves.toBeUndefined();
      expect(brave.search).toHaveBeenCalledTimes(1);
      expect(listings.fetchBoard).toHaveBeenCalledTimes(3);
    });

    it('goes on to the next board when one is not read', async () => {
      brave.search.mockResolvedValue(['https://job-boards.greenhouse.io/northwind/jobs/1', 'https://jobs.lever.co/northwind/a1']);
      listings.fetchBoard
        .mockRejectedValueOnce(new Error('HTTP 404'))
        .mockResolvedValueOnce({ company: 'Northwind', positions: [position('Backend Engineer')] });

      await expect(subjectUnderTest.find(VACANCY)).resolves.toBeDefined();
    });

    it('drops the quotes of the company from the query', async () => {
      await subjectUnderTest.find({ ...VACANCY, vacancy_company: 'North"wind' });

      expect(brave.search).toHaveBeenCalledWith('site:jobs.lever.co "Northwind"');
    });

    it('searches nothing without the key of the web search', async () => {
      brave.isEnabled.mockReturnValue(false);

      await expect(subjectUnderTest.find(VACANCY)).resolves.toBeUndefined();
      expect(brave.search).not.toHaveBeenCalled();
    });

    it('passes a failed web search on', async () => {
      brave.search.mockRejectedValue(new Error('BRAVE_SEARCH_FAILED: HTTP 500'));

      await expect(subjectUnderTest.find(VACANCY)).rejects.toThrow('BRAVE_SEARCH_FAILED');
    });
  });
});
