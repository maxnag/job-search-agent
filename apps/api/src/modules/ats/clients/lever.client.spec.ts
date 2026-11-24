import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ATSKindEnum, SourceFetchModeEnum, WorkModeEnum } from '@job-agent/shared';

import { CrawlPaceEnum } from '../../crawler/enums/crawl-pace.enum.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { LeverClient } from './lever.client.js';

/**
 * A page of the crawler with a JSON body
 *
 * @param {unknown} body
 *
 * @returns {{ url: string; status: number; headers: Record<string, string>; html: string }}
 */
function page(body: unknown): { url: string; status: number; headers: Record<string, string>; html: string } {
  return { url: 'https://api.lever.co', status: 200, headers: {}, html: JSON.stringify(body) };
}

/**
 * A posting of a Lever site
 *
 * @param {string} id
 * @param {Record<string, unknown>} changes
 *
 * @returns {Record<string, unknown>}
 */
function posting(id: string, changes: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    text: 'Full Stack Developer',
    hostedUrl: `https://jobs.lever.co/Contoso/${id}`,
    country: 'IL',
    workplaceType: 'hybrid',
    categories: { location: 'Tel Aviv', team: 'Platform', department: 'R&D', commitment: 'Full-time' },
    ...changes
  };
}

describe('LeverClient (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: LeverClient;
  let crawlerService: DeepMocked<CrawlerService>;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      providers: [LeverClient, { provide: CrawlerService, useValue: createMock<CrawlerService>() }]
    }).compile();

    subjectUnderTest = moduleFixture.get(LeverClient);
    crawlerService = moduleFixture.get(CrawlerService);
  });

  afterEach(async () => {
    await moduleFixture.close();
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
    expect(subjectUnderTest.kind).toBe(ATSKindEnum.LEVER);
  });

  describe('listPositions', () => {
    it('reads the site API at the API pace and maps each posting', async () => {
      crawlerService.fetchPage.mockResolvedValue(page([posting('a1')]));

      const listing = await subjectUnderTest.listPositions('Contoso', 4000);

      expect(crawlerService.fetchPage).toHaveBeenCalledWith(
        'https://api.lever.co/v0/postings/Contoso?mode=json',
        SourceFetchModeEnum.HTML,
        {
          timeoutMs: 4000,
          pace: CrawlPaceEnum.API
        }
      );
      expect(listing).toEqual({
        company: null,
        positions: [
          {
            externalId: 'a1',
            url: 'https://jobs.lever.co/Contoso/a1',
            title: 'Full Stack Developer',
            country: 'IL',
            city: null,
            workMode: WorkModeEnum.HYBRID,
            location: 'Tel Aviv',
            department: 'Platform'
          }
        ]
      });
    });

    it('prefers all locations to the single one and the department when there is no team', async () => {
      crawlerService.fetchPage.mockResolvedValue(
        page([posting('a2', { categories: { location: 'Tel Aviv', allLocations: ['Tel Aviv', 'Haifa'], department: 'R&D' } })])
      );

      const [position] = (await subjectUnderTest.listPositions('Contoso')).positions;

      expect(position?.location).toBe('Tel Aviv; Haifa');
      expect(position?.department).toBe('R&D');
    });

    it('falls back to the single location when all locations are empty', async () => {
      crawlerService.fetchPage.mockResolvedValue(page([posting('a3', { categories: { location: 'Haifa', allLocations: [] } })]));

      expect((await subjectUnderTest.listPositions('Contoso')).positions[0]?.location).toBe('Haifa');
    });

    it('keeps a posting without categories, country and work mode', async () => {
      crawlerService.fetchPage.mockResolvedValue(page([posting('a4', { categories: null, country: null, workplaceType: 'flexible' })]));

      expect((await subjectUnderTest.listPositions('Contoso')).positions[0]).toEqual(
        expect.objectContaining({ country: null, workMode: null, location: null, department: null })
      );
    });

    it('drops a posting that does not match the schema and warns', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      crawlerService.fetchPage.mockResolvedValue(page([posting('a1'), { id: 'a2' }]));

      expect((await subjectUnderTest.listPositions('Contoso')).positions).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({ board: 'Contoso', dropped: 1 }));
    });

    it('throws ATS_RESPONSE_INVALID when the body is not a list', async () => {
      crawlerService.fetchPage.mockResolvedValue(page({ ok: false }));

      await expect(subjectUnderTest.listPositions('Contoso')).rejects.toThrow('ATS_RESPONSE_INVALID: Lever site Contoso');
    });
  });

  describe('fetchPosting', () => {
    it('reads the posting and builds its HTML with the lists', async () => {
      crawlerService.fetchPage.mockResolvedValue(
        page(
          posting('a1', {
            description: '<p>About the team</p>',
            lists: [{ text: 'You <will>', content: '<li>Ship</li>' }],
            additional: '<p>Benefits</p>'
          })
        )
      );

      const html = await subjectUnderTest.fetchPosting({ board: 'Contoso', externalId: 'a1', url: 'https://example.com' });

      expect(crawlerService.fetchPage).toHaveBeenCalledWith(
        'https://api.lever.co/v0/postings/Contoso/a1?mode=json',
        SourceFetchModeEnum.HTML,
        {
          pace: CrawlPaceEnum.API
        }
      );
      expect(html).toBe(
        '<main><p>Full Stack Developer</p><p>Tel Aviv</p><p>Full-time</p><p>hybrid</p><p>Platform</p>' +
          '<section><p>About the team</p></section><section><h3>You &lt;will&gt;</h3><li>Ship</li></section>' +
          '<section><p>Benefits</p></section></main>'
      );
    });

    it('builds empty sections for a posting without texts', async () => {
      crawlerService.fetchPage.mockResolvedValue(page(posting('a1', { categories: null, workplaceType: null })));

      expect(await subjectUnderTest.fetchPosting({ board: 'Contoso', externalId: 'a1', url: 'https://example.com' })).toBe(
        '<main><p>Full Stack Developer</p><section></section><section></section></main>'
      );
    });

    it('throws ATS_RESPONSE_INVALID for a posting of another shape', async () => {
      crawlerService.fetchPage.mockResolvedValue(page({ id: 'a1' }));

      await expect(subjectUnderTest.fetchPosting({ board: 'Contoso', externalId: 'a1', url: 'https://example.com' })).rejects.toThrow(
        'ATS_RESPONSE_INVALID: Lever posting Contoso/a1'
      );
    });
  });
});
