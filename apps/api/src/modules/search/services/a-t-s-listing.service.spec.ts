import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ATSKindEnum, RoleFamilyEnum, SeniorityLevelEnum, SourceFetchModeEnum, WorkModeEnum } from '@job-agent/shared';

import type { IATSClient, IATSListing, IATSPosition } from '../../ats/interfaces/a-t-s-client.interface.js';
import { ATSClientRegistry } from '../../ats/services/a-t-s-client.registry.js';
import type { IProfilePreferencesEntry } from '../interfaces/profile-preferences-entry.interface.js';
import type { SourceRowType } from '../interfaces/source-row.interface.js';
import { ATSListingService } from './a-t-s-listing.service.js';
import { ListingExtractionService } from './listing-extraction.service.js';

const SOURCE = {
  source_id: 3,
  source_name: 'Northwind',
  source_url: 'https://job-boards.greenhouse.io/northwind',
  source_fetch_mode: SourceFetchModeEnum.ATS
} as SourceRowType;

const PROFILE: IProfilePreferencesEntry = {
  name: 'developer',
  preferences: {
    role_families: [RoleFamilyEnum.BACKEND],
    places: [{ country: 'IL', work_modes: [WorkModeEnum.HYBRID], excluded_cities: [] }],
    excluded_companies: ['Tailspin']
  }
};

/**
 * A position of a board
 *
 * @param {string} externalId
 * @param {Partial<IATSPosition>} changes
 *
 * @returns {IATSPosition}
 */
function position(externalId: string, changes: Partial<IATSPosition> = {}): IATSPosition {
  return {
    externalId,
    url: `https://job-boards.greenhouse.io/northwind/jobs/${externalId}`,
    title: 'Backend Engineer',
    country: 'IL',
    city: 'Haifa',
    workMode: WorkModeEnum.HYBRID,
    location: 'Haifa, Israel',
    department: 'R&D',
    ...changes
  };
}

describe('ATSListingService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: ATSListingService;
  let listingExtraction: DeepMocked<ListingExtractionService>;
  let registry: DeepMocked<ATSClientRegistry>;
  let client: DeepMocked<IATSClient>;

  beforeEach(async () => {
    listingExtraction = createMock<ListingExtractionService>();
    registry = createMock<ATSClientRegistry>();
    client = createMock<IATSClient>();
    registry.findOne.mockReturnValue(client);
    moduleFixture = await Test.createTestingModule({
      providers: [
        ATSListingService,
        { provide: ListingExtractionService, useValue: listingExtraction },
        { provide: ATSClientRegistry, useValue: registry }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(ATSListingService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('fetch', () => {
    it('lists the board of the source through the client of its system', async () => {
      const listing: IATSListing = { company: 'Northwind', positions: [position('1')] };

      client.listPositions.mockResolvedValue(listing);

      await expect(subjectUnderTest.fetch(SOURCE)).resolves.toBe(listing);
      expect(registry.findOne).toHaveBeenCalledWith(ATSKindEnum.GREENHOUSE);
      expect(client.listPositions).toHaveBeenCalledWith('northwind', undefined);
    });

    it('throws SOURCE_URL_NOT_ATS for a source whose link is not a supported board', async () => {
      await expect(subjectUnderTest.fetch({ ...SOURCE, source_url: 'https://careers.example.com/jobs' })).rejects.toThrow(
        'SOURCE_URL_NOT_ATS: source 3'
      );
    });
  });

  describe('fetchBoard', () => {
    it('passes the time limit to the client', async () => {
      client.listPositions.mockResolvedValue({ company: null, positions: [] });

      await subjectUnderTest.fetchBoard({ kind: ATSKindEnum.LEVER, board: 'Contoso' }, 8000);

      expect(registry.findOne).toHaveBeenCalledWith(ATSKindEnum.LEVER);
      expect(client.listPositions).toHaveBeenCalledWith('Contoso', 8000);
    });
  });

  describe('passingPositions and countPassing', () => {
    const listing: IATSListing = {
      company: 'Northwind',
      positions: [position('1'), position('2', { country: 'US' }), position('3', { workMode: WorkModeEnum.ONSITE })]
    };

    it('keeps the positions the profiles keep by place', () => {
      expect(subjectUnderTest.passingPositions(listing, 'Northwind', [PROFILE]).map(item => item.externalId)).toEqual(['1']);
      expect(subjectUnderTest.countPassing(listing, 'Northwind', [PROFILE])).toBe(1);
    });

    it('drops every position of an excluded company', () => {
      expect(subjectUnderTest.countPassing(listing, 'Tailspin', [PROFILE])).toBe(0);
    });

    it('drops every position without profiles', () => {
      expect(subjectUnderTest.countPassing(listing, 'Northwind', [])).toBe(0);
    });
  });

  describe('classify', () => {
    it('sends only the kept positions to the LLM, without URLs, and merges its reading into the board data', async () => {
      const kept = position('1', { city: null, workMode: null, country: 'IL' });
      const abroad = position('2', { country: 'US', title: 'Frontend Engineer' });

      listingExtraction.classify.mockResolvedValue([
        {
          url: kept.url,
          title: 'Backend Engineer',
          company: 'Northwind',
          country: 'GB',
          city: 'Haifa',
          workMode: WorkModeEnum.HYBRID,
          roleFamily: RoleFamilyEnum.BACKEND,
          level: SeniorityLevelEnum.SENIOR
        }
      ]);

      const result = await subjectUnderTest.classify(SOURCE, { company: null, positions: [kept, abroad] }, [
        {
          ...PROFILE,
          preferences: { ...PROFILE.preferences, places: [{ country: 'IL', work_modes: Object.values(WorkModeEnum), excluded_cities: [] }] }
        }
      ]);

      expect(listingExtraction.classify).toHaveBeenCalledWith(
        'https://job-boards.greenhouse.io/northwind',
        [{ url: kept.url, text: 'Backend Engineer', context: 'Haifa, Israel · R&D' }],
        'Northwind',
        false
      );
      expect(result.links).toBe(2);
      expect(result.positions).toEqual([
        {
          url: abroad.url,
          externalId: '2',
          title: 'Frontend Engineer',
          company: 'Northwind',
          country: 'US',
          city: 'Haifa',
          workMode: WorkModeEnum.HYBRID,
          roleFamily: null,
          level: null
        },
        {
          url: kept.url,
          externalId: '1',
          title: 'Backend Engineer',
          company: 'Northwind',
          country: 'IL',
          city: 'Haifa',
          workMode: WorkModeEnum.HYBRID,
          roleFamily: RoleFamilyEnum.BACKEND,
          level: SeniorityLevelEnum.SENIOR
        }
      ]);
    });

    it('takes the company the board names, and leaves out a kept position the LLM did not read as a posting', async () => {
      listingExtraction.classify.mockResolvedValue([]);

      const result = await subjectUnderTest.classify(SOURCE, { company: ' Northwind Labs ', positions: [position('1')] }, [PROFILE]);

      expect(listingExtraction.classify).toHaveBeenCalledWith(expect.any(String), expect.any(Array), 'Northwind Labs', false);
      expect(result).toEqual({ pages: 1, links: 1, positions: [], gaps: [] });
    });

    it('asks the LLM nothing new for a board where every position is dropped', async () => {
      listingExtraction.classify.mockResolvedValue([]);

      const result = await subjectUnderTest.classify(SOURCE, { company: null, positions: [position('1', { country: 'US' })] }, [PROFILE]);

      expect(listingExtraction.classify).toHaveBeenCalledWith(expect.any(String), [], 'Northwind', false);
      expect(result.positions).toHaveLength(1);
    });
  });
});
