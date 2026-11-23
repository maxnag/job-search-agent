import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceFetchModeEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { CrawlErrorCodeEnum } from '../enums/crawl-error-code.enum.js';
import { CrawlError } from '../errors/crawl.error.js';
import { AddressGuardService } from '../services/address-guard.service.js';
import { HTMLPageFetcher } from './h-t-m-l-page.fetcher.js';

const USER_AGENT = 'Mozilla/5.0 (fictional)';

/**
 * A redirect answer
 *
 * @param {string} location
 * @param {number} status
 *
 * @returns {Response}
 */
function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } });
}

describe('HTMLPageFetcher (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: HTMLPageFetcher;
  let guard: DeepMocked<AddressGuardService>;
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(async () => {
    guard = createMock<AddressGuardService>();
    guard.assertPublic.mockResolvedValue();
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    moduleFixture = await Test.createTestingModule({
      providers: [
        HTMLPageFetcher,
        { provide: AddressGuardService, useValue: guard },
        { provide: ConfigService, useValue: createConfigMock({ HTTP_USER_AGENT: USER_AGENT, HTTP_TIMEOUT_MS: 5000 }) }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(HTMLPageFetcher);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await moduleFixture.close();
  });

  it('should be defined and serve the html mode', () => {
    expect(subjectUnderTest).toBeDefined();
    expect(subjectUnderTest.mode).toBe(SourceFetchModeEnum.HTML);
  });

  it('requests the page as a browser, without following redirects itself, and returns it', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Jobs</html>', { status: 200, headers: { 'content-type': 'text/html' } }));

    const page = await subjectUnderTest.fetch(new URL('https://careers.example.com/jobs'));

    expect(page).toEqual({
      url: 'https://careers.example.com/jobs',
      status: 200,
      headers: { 'content-type': 'text/html' },
      html: '<html>Jobs</html>'
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = init?.headers as Record<string, string>;

    expect(url).toEqual(new URL('https://careers.example.com/jobs'));
    expect(init?.redirect).toBe('manual');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(headers['user-agent']).toBe(USER_AGENT);
    expect(headers.accept).toContain('text/html');
    expect(headers['accept-language']).toContain('en');
  });

  it('returns an error status as it is', async () => {
    fetchMock.mockResolvedValue(new Response('gone', { status: 404 }));

    await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/jobs/1'))).resolves.toMatchObject({
      status: 404,
      html: 'gone'
    });
  });

  it('follows redirects hop by hop, a relative one too, checking each address first', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect('https://www.example.com/careers', 301))
      .mockResolvedValueOnce(redirect('/careers/', 308))
      .mockResolvedValueOnce(new Response('list'));

    const page = await subjectUnderTest.fetch(new URL('http://example.com/jobs'));

    expect(page.url).toBe('https://www.example.com/careers/');
    expect(guard.assertPublic.mock.calls.map(([url]) => url.href)).toEqual([
      'http://example.com/jobs',
      'https://www.example.com/careers',
      'https://www.example.com/careers/'
    ]);
  });

  it('never requests a hop that resolves to a private address', async () => {
    fetchMock.mockResolvedValueOnce(redirect('http://127.0.0.1:3999/queues'));
    guard.assertPublic
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new CrawlError(CrawlErrorCodeEnum.PRIVATE_ADDRESS, '127.0.0.1:3999 resolves to 127.0.0.1'));

    await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/jobs'))).rejects.toMatchObject({
      code: CrawlErrorCodeEnum.PRIVATE_ADDRESS
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a redirect to anything but http(s)', async () => {
    fetchMock.mockResolvedValueOnce(redirect('ftp://files.example.com/jobs.txt'));

    await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/jobs'))).rejects.toMatchObject({
      code: CrawlErrorCodeEnum.INVALID_URL,
      message: 'INVALID_URL: careers.example.com redirects to ftp://files.example.com/jobs.txt'
    });
  });

  it('gives up after ten redirects', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(redirect('/loop')));

    await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/loop'))).rejects.toThrow(
      'careers.example.com: more than 10 redirects'
    );
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it('returns a redirect status without a location as a page', async () => {
    fetchMock.mockResolvedValue(new Response('moved', { status: 302 }));

    await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/jobs'))).resolves.toMatchObject({
      status: 302,
      html: 'moved'
    });
  });

  it('passes a network failure on', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/jobs'))).rejects.toThrow('fetch failed');
  });
});
