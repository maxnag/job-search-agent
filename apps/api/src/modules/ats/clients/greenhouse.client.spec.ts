import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ATSKindEnum, SourceFetchModeEnum } from '@job-agent/shared';

import { CrawlPaceEnum } from '../../crawler/enums/crawl-pace.enum.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { GreenhouseClient } from './greenhouse.client.js';

/**
 * A page of the crawler with a JSON body
 *
 * @param {unknown} body
 *
 * @returns {{ url: string; status: number; headers: Record<string, string>; html: string }}
 */
function page(body: unknown): { url: string; status: number; headers: Record<string, string>; html: string } {
  return { url: 'https://boards-api.greenhouse.io', status: 200, headers: {}, html: JSON.stringify(body) };
}

/**
 * A job of the board list
 *
 * @param {number} id
 * @param {Record<string, unknown>} changes
 *
 * @returns {Record<string, unknown>}
 */
function job(id: number, changes: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    title: 'Backend Engineer',
    absolute_url: `https://job-boards.greenhouse.io/northwind/jobs/${id}`,
    company_name: 'Northwind',
    location: { name: 'Haifa, Israel' },
    ...changes
  };
}

describe('GreenhouseClient (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: GreenhouseClient;
  let crawlerService: DeepMocked<CrawlerService>;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      providers: [GreenhouseClient, { provide: CrawlerService, useValue: createMock<CrawlerService>() }]
    }).compile();

    subjectUnderTest = moduleFixture.get(GreenhouseClient);
    crawlerService = moduleFixture.get(CrawlerService);
  });

  afterEach(async () => {
    await moduleFixture.close();
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
    expect(subjectUnderTest.kind).toBe(ATSKindEnum.GREENHOUSE);
  });

  describe('listPositions', () => {
    it('reads the board API at the API pace and maps each job', async () => {
      crawlerService.fetchPage.mockResolvedValue(page({ jobs: [job(101), job(102, { company_name: null, location: null })] }));

      const listing = await subjectUnderTest.listPositions('north wind', 5000);

      expect(crawlerService.fetchPage).toHaveBeenCalledWith(
        'https://boards-api.greenhouse.io/v1/boards/north%20wind/jobs',
        SourceFetchModeEnum.HTML,
        { timeoutMs: 5000, pace: CrawlPaceEnum.API }
      );
      expect(listing).toEqual({
        company: 'Northwind',
        positions: [
          {
            externalId: '101',
            url: 'https://job-boards.greenhouse.io/northwind/jobs/101',
            title: 'Backend Engineer',
            country: null,
            city: null,
            workMode: null,
            location: 'Haifa, Israel',
            department: null
          },
          expect.objectContaining({ externalId: '102', location: null })
        ]
      });
    });

    it('takes the company from the first job that names it', async () => {
      crawlerService.fetchPage.mockResolvedValue(
        page({ jobs: [job(1, { company_name: null }), job(2, { company_name: 'Northwind Labs' })] })
      );

      expect((await subjectUnderTest.listPositions('northwind')).company).toBe('Northwind Labs');
    });

    it('gives no company for an empty board', async () => {
      crawlerService.fetchPage.mockResolvedValue(page({ jobs: [] }));

      expect(await subjectUnderTest.listPositions('northwind')).toEqual({ company: null, positions: [] });
    });

    it('drops a job that does not match the schema and warns once', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      crawlerService.fetchPage.mockResolvedValue(page({ jobs: [job(1), { id: 'x' }, job(3, { title: '' })] }));

      const listing = await subjectUnderTest.listPositions('northwind');

      expect(listing.positions.map(position => position.externalId)).toEqual(['1']);
      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Board jobs dropped by the schema', dropped: 2 }));
    });

    it('throws ATS_RESPONSE_INVALID for a body of another shape', async () => {
      crawlerService.fetchPage.mockResolvedValue(page({ error: 'not found' }));

      await expect(subjectUnderTest.listPositions('northwind')).rejects.toThrow('ATS_RESPONSE_INVALID');
    });
  });

  describe('fetchPosting', () => {
    it('reads the job and builds its HTML with the decoded content', async () => {
      crawlerService.fetchPage.mockResolvedValue(
        page(
          job(101, {
            content: '&lt;p&gt;Build &amp;amp; ship&lt;/p&gt;',
            departments: [{ name: ' R&D ' }, { name: 'Platform' }],
            offices: [{ name: 'Haifa' }]
          })
        )
      );

      const html = await subjectUnderTest.fetchPosting({ board: 'northwind', externalId: '101', url: 'https://example.com' });

      expect(crawlerService.fetchPage).toHaveBeenCalledWith(
        'https://boards-api.greenhouse.io/v1/boards/northwind/jobs/101',
        SourceFetchModeEnum.HTML,
        { pace: CrawlPaceEnum.API }
      );
      expect(html).toBe(
        '<main><p>Backend Engineer</p><p>Northwind</p><p>Haifa, Israel</p><p>R&amp;D, Platform</p><p>Haifa</p>' +
          '<section><p>Build &amp; ship</p></section></main>'
      );
    });

    it('builds the header alone for a job without content', async () => {
      crawlerService.fetchPage.mockResolvedValue(page(job(7, { company_name: null, location: null })));

      expect(await subjectUnderTest.fetchPosting({ board: 'northwind', externalId: '7', url: 'https://example.com' })).toBe(
        '<main><p>Backend Engineer</p></main>'
      );
    });

    it('throws ATS_RESPONSE_INVALID for a job of another shape', async () => {
      crawlerService.fetchPage.mockResolvedValue(page({ id: 7 }));

      await expect(subjectUnderTest.fetchPosting({ board: 'northwind', externalId: '7', url: 'https://example.com' })).rejects.toThrow(
        'ATS_RESPONSE_INVALID: Greenhouse job northwind/7 does not match the schema'
      );
    });
  });
});
