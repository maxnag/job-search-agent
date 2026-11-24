import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ATSKindEnum, SourceFetchModeEnum, WorkModeEnum } from '@job-agent/shared';

import type { IATSPosition } from '../../ats/interfaces/a-t-s-client.interface.js';
import type { SourceRowType } from '../interfaces/source-row.interface.js';
import { SourceRepository } from '../repositories/source.repository.js';
import { ATSListingService } from './a-t-s-listing.service.js';
import { ProfilePreferencesService } from './profile-preferences.service.js';
import { SourceRegistrationService } from './source-registration.service.js';

const BOARD_URL = 'https://jobs.lever.co/Contoso';

/**
 * A position of a board
 *
 * @param {string | null} country
 *
 * @returns {IATSPosition}
 */
function position(country: string | null): IATSPosition {
  return {
    externalId: '1',
    url: `${BOARD_URL}/1`,
    title: 'Backend Engineer',
    country,
    city: null,
    workMode: WorkModeEnum.HYBRID,
    location: null,
    department: null
  };
}

/**
 * A stored source
 *
 * @param {Partial<SourceRowType>} changes
 *
 * @returns {SourceRowType}
 */
function source(changes: Partial<SourceRowType> = {}): SourceRowType {
  return { source_id: 8, source_url: BOARD_URL, source_name: 'Contoso', ...changes } as SourceRowType;
}

describe('SourceRegistrationService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: SourceRegistrationService;
  let listings: DeepMocked<ATSListingService>;
  let preferences: DeepMocked<ProfilePreferencesService>;
  let sources: DeepMocked<SourceRepository>;

  beforeEach(async () => {
    listings = createMock<ATSListingService>();
    preferences = createMock<ProfilePreferencesService>();
    sources = createMock<SourceRepository>();
    listings.fetchBoard.mockResolvedValue({ company: 'Contoso Ltd', positions: [position('IL'), position(null), position('US')] });
    listings.countPassing.mockReturnValue(1);
    preferences.findAll.mockResolvedValue([]);
    sources.findByURL.mockResolvedValue(undefined);
    sources.create.mockImplementation(values =>
      Promise.resolve(source({ source_url: values.source_url, source_name: values.source_name }))
    );
    moduleFixture = await Test.createTestingModule({
      providers: [
        SourceRegistrationService,
        { provide: ATSListingService, useValue: listings },
        { provide: ProfilePreferencesService, useValue: preferences },
        { provide: SourceRepository, useValue: sources }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(SourceRegistrationService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('add — a board of an applicant tracking system', () => {
    it('reads the board and adds it by its canonical link with the company the system names', async () => {
      const result = await subjectUnderTest.add({ url: `${BOARD_URL}/1c2d3e4f?lever-source=feed` });

      expect(listings.fetchBoard).toHaveBeenCalledWith({ kind: ATSKindEnum.LEVER, board: 'Contoso' });
      expect(listings.countPassing).toHaveBeenCalledWith(expect.objectContaining({ company: 'Contoso Ltd' }), 'Contoso Ltd', []);
      expect(sources.create).toHaveBeenCalledWith({
        source_url: BOARD_URL,
        source_name: 'Contoso Ltd',
        source_fetch_mode: SourceFetchModeEnum.ATS
      });
      expect(result.source.source_url).toBe(BOARD_URL);
      expect(result).toMatchObject({
        created: true,
        board: { kind: ATSKindEnum.LEVER, board: 'Contoso' },
        positions: 3,
        passing: 1,
        located: 2
      });
    });

    it('prefers the name given by the owner', async () => {
      await subjectUnderTest.add({ url: BOARD_URL, name: ' Contoso Israel ' });

      expect(sources.create).toHaveBeenCalledWith(expect.objectContaining({ source_name: 'Contoso Israel' }));
    });

    it('names the source after the board when nothing else names it', async () => {
      listings.fetchBoard.mockResolvedValue({ company: '  ', positions: [] });

      const result = await subjectUnderTest.add({ url: BOARD_URL, name: ' ' });

      expect(sources.create).toHaveBeenCalledWith(expect.objectContaining({ source_name: 'Contoso' }));
      expect(result).toEqual(expect.objectContaining({ positions: 0, located: 0 }));
    });

    it('returns the source that already has the board, without reading it', async () => {
      const existing = source();

      sources.findByURL.mockResolvedValue(existing);

      await expect(subjectUnderTest.add({ url: `${BOARD_URL}/1` })).resolves.toEqual({
        source: existing,
        created: false,
        board: { kind: ATSKindEnum.LEVER, board: 'Contoso' }
      });
      expect(listings.fetchBoard).not.toHaveBeenCalled();
      expect(sources.create).not.toHaveBeenCalled();
    });

    it('lets a board that cannot be read fail the command, adding nothing', async () => {
      listings.fetchBoard.mockRejectedValue(new Error('HTTP 404'));

      await expect(subjectUnderTest.add({ url: BOARD_URL })).rejects.toThrow('HTTP 404');
      expect(sources.create).not.toHaveBeenCalled();
    });
  });

  describe('add — a career page', () => {
    it('adds a career page as html, named after its host without www', async () => {
      const result = await subjectUnderTest.add({ url: 'https://www.northwind.example/careers' });

      expect(sources.create).toHaveBeenCalledWith({
        source_url: 'https://www.northwind.example/careers',
        source_name: 'northwind.example',
        source_fetch_mode: SourceFetchModeEnum.HTML
      });
      expect(result.created).toBe(true);
      expect(result.board).toBeUndefined();
    });

    it('returns the existing source when the link is already stored', async () => {
      const existing = source({ source_id: 2, source_url: 'https://northwind.example/careers' });

      sources.create.mockResolvedValue(undefined);
      sources.findByURL.mockResolvedValue(existing);

      await expect(subjectUnderTest.add({ url: 'https://northwind.example/careers', name: 'Northwind' })).resolves.toEqual({
        source: existing,
        created: false
      });
    });

    it('throws SOURCE_NOT_FOUND when the source neither is created nor exists', async () => {
      sources.create.mockResolvedValue(undefined);

      await expect(subjectUnderTest.add({ url: 'https://northwind.example/careers' })).rejects.toThrow('SOURCE_NOT_FOUND');
    });

    it.each(['ftp://northwind.example/jobs', 'northwind careers'])('throws SOURCE_URL_INVALID for %j', async url => {
      await expect(subjectUnderTest.add({ url })).rejects.toThrow('SOURCE_URL_INVALID');
      expect(sources.create).not.toHaveBeenCalled();
    });
  });
});
