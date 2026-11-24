import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ATSKindEnum, SourceFetchModeEnum, WorkModeEnum } from '@job-agent/shared';

import { CrawlErrorCodeEnum } from '../../crawler/enums/crawl-error-code.enum.js';
import { CrawlError } from '../../crawler/errors/crawl.error.js';
import { CrawlerService } from '../../crawler/services/crawler.service.js';
import { ComeetClient } from './comeet.client.js';

/**
 * A hosted page with its scripts
 *
 * @param {Record<string, unknown>} variables
 *
 * @returns {{ url: string; status: number; headers: Record<string, string>; html: string }}
 */
function page(variables: Record<string, unknown>): { url: string; status: number; headers: Record<string, string>; html: string } {
  const scripts = Object.entries(variables)
    .map(([name, value]) => `<script>var ${name} = ${JSON.stringify(value)};</script>`)
    .join('');

  return { url: 'https://www.comeet.com', status: 200, headers: {}, html: `<html><body>${scripts}</body></html>` };
}

/**
 * A position of a Comeet company
 *
 * @param {string} uid
 * @param {Record<string, unknown>} changes
 *
 * @returns {Record<string, unknown>}
 */
function position(uid: string, changes: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid,
    name: 'Backend Developer',
    department: 'Engineering',
    company_name: 'Fabrikam',
    location: { name: 'Haifa, Israel', country: 'IL', city: 'Haifa' },
    workplace_type: 'Hybrid',
    employment_type: 'Full-time',
    experience_level: 'Senior',
    url_comeet_hosted_page: `https://www.comeet.com/jobs/fabrikam/A1.00B/backend-developer/${uid}`,
    ...changes
  };
}

describe('ComeetClient (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: ComeetClient;
  let crawlerService: DeepMocked<CrawlerService>;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      providers: [ComeetClient, { provide: CrawlerService, useValue: createMock<CrawlerService>() }]
    }).compile();

    subjectUnderTest = moduleFixture.get(ComeetClient);
    crawlerService = moduleFixture.get(CrawlerService);
  });

  afterEach(async () => {
    await moduleFixture.close();
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
    expect(subjectUnderTest.kind).toBe(ATSKindEnum.COMEET);
  });

  describe('listPositions', () => {
    it('reads the hosted board page at the site pace and maps each position', async () => {
      crawlerService.fetchPage.mockResolvedValue(
        page({ COMPANY_DATA: { name: 'Fabrikam Ltd' }, COMPANY_POSITIONS_DATA: [position('C2.D41')] })
      );

      const listing = await subjectUnderTest.listPositions('fabrikam/A1.00B', 6000);

      expect(crawlerService.fetchPage).toHaveBeenCalledWith('https://www.comeet.com/jobs/fabrikam/A1.00B', SourceFetchModeEnum.HTML, {
        timeoutMs: 6000
      });
      expect(listing).toEqual({
        company: 'Fabrikam Ltd',
        positions: [
          {
            externalId: 'C2.D41',
            url: 'https://www.comeet.com/jobs/fabrikam/A1.00B/backend-developer/C2.D41',
            title: 'Backend Developer',
            country: 'IL',
            city: 'Haifa',
            workMode: WorkModeEnum.HYBRID,
            location: 'Haifa, Israel',
            department: 'Engineering'
          }
        ]
      });
    });

    it('takes the company from a position when the page has no company data', async () => {
      crawlerService.fetchPage.mockResolvedValue(
        page({ COMPANY_POSITIONS_DATA: [position('A', { company_name: null }), position('B', { company_name: 'Fabrikam Labs' })] })
      );

      expect((await subjectUnderTest.listPositions('fabrikam/A1.00B')).company).toBe('Fabrikam Labs');
    });

    it('gives no company when nothing names it', async () => {
      crawlerService.fetchPage.mockResolvedValue(page({ COMPANY_POSITIONS_DATA: [] }));

      expect(await subjectUnderTest.listPositions('fabrikam/A1.00B')).toEqual({ company: null, positions: [] });
    });

    it('keeps a position without location, work mode and department', async () => {
      crawlerService.fetchPage.mockResolvedValue(
        page({ COMPANY_POSITIONS_DATA: [position('A', { location: null, workplace_type: null, department: null })] })
      );

      expect((await subjectUnderTest.listPositions('fabrikam/A1.00B')).positions[0]).toEqual(
        expect.objectContaining({ country: null, city: null, workMode: null, location: null, department: null })
      );
    });

    it('drops a position that does not match the schema and warns', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      crawlerService.fetchPage.mockResolvedValue(page({ COMPANY_POSITIONS_DATA: [position('A'), { uid: 'B' }] }));

      expect((await subjectUnderTest.listPositions('fabrikam/A1.00B')).positions).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({ board: 'fabrikam/A1.00B', dropped: 1 }));
    });

    it('throws a crawl error when the page has no positions — the board is gone', async () => {
      crawlerService.fetchPage.mockResolvedValue(page({}));

      const error = await subjectUnderTest.listPositions('fabrikam/A1.00B').catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(CrawlError);
      expect((error as CrawlError).code).toBe(CrawlErrorCodeEnum.FETCH_HTTP_ERROR);
    });

    it('throws ATS_RESPONSE_INVALID when the positions are not a list', async () => {
      crawlerService.fetchPage.mockResolvedValue(page({ COMPANY_POSITIONS_DATA: { uid: 'A' } }));

      await expect(subjectUnderTest.listPositions('fabrikam/A1.00B')).rejects.toThrow('ATS_RESPONSE_INVALID');
    });
  });

  describe('fetchPosting', () => {
    const request = { board: 'fabrikam/A1.00B', externalId: 'C2.D41', url: 'https://www.comeet.com/jobs/fabrikam/A1.00B/x/C2.D41' };

    it('reads the position page and builds its HTML from the details', async () => {
      crawlerService.fetchPage.mockResolvedValue(
        page({
          POSITION_DATA: position('C2.D41', {
            custom_fields: {
              details: [
                { name: 'Requirements', value: '<ul><li>Node.js</li></ul>' },
                { name: null, value: null }
              ]
            }
          })
        })
      );

      const html = await subjectUnderTest.fetchPosting(request);

      expect(crawlerService.fetchPage).toHaveBeenCalledWith(request.url, SourceFetchModeEnum.HTML);
      expect(html).toBe(
        '<main><p>Backend Developer</p><p>Fabrikam</p><p>Haifa, Israel</p><p>Hybrid</p><p>Full-time</p><p>Senior</p>' +
          '<p>Engineering</p><section><h3>Requirements</h3><ul><li>Node.js</li></ul></section><section><h3></h3></section></main>'
      );
    });

    it('builds the header alone for a position without details', async () => {
      crawlerService.fetchPage.mockResolvedValue(
        page({
          POSITION_DATA: position('C2.D41', {
            company_name: null,
            location: null,
            workplace_type: null,
            employment_type: null,
            experience_level: null,
            department: null
          })
        })
      );

      expect(await subjectUnderTest.fetchPosting(request)).toBe('<main><p>Backend Developer</p></main>');
    });

    it('throws a crawl error when the page has no position — the position is gone', async () => {
      crawlerService.fetchPage.mockResolvedValue(page({}));

      await expect(subjectUnderTest.fetchPosting(request)).rejects.toBeInstanceOf(CrawlError);
    });

    it('throws ATS_RESPONSE_INVALID for a position of another shape', async () => {
      crawlerService.fetchPage.mockResolvedValue(page({ POSITION_DATA: { uid: 'C2.D41' } }));

      await expect(subjectUnderTest.fetchPosting(request)).rejects.toThrow('ATS_RESPONSE_INVALID: Comeet position fabrikam/A1.00B/C2.D41');
    });
  });
});
