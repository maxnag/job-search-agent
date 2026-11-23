import { lookup } from 'node:dns/promises';

import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CrawlErrorCodeEnum } from '../enums/crawl-error-code.enum.js';
import { AddressGuardService } from './address-guard.service.js';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

const lookupMock = vi.mocked(lookup as (host: string, options: { all: true }) => Promise<{ address: string; family: number }[]>);

/**
 * Make the resolver answer with the given addresses
 *
 * @param {string[]} addresses
 *
 * @returns {void}
 */
function resolveTo(...addresses: string[]): void {
  lookupMock.mockResolvedValue(addresses.map(address => ({ address, family: address.includes(':') ? 6 : 4 })));
}

describe('AddressGuardService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: AddressGuardService;

  beforeEach(async () => {
    lookupMock.mockReset();
    moduleFixture = await Test.createTestingModule({ providers: [AddressGuardService] }).compile();
    subjectUnderTest = moduleFixture.get(AddressGuardService);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  describe('assertPublic', () => {
    it('lets a host with public addresses through, resolving every address', async () => {
      resolveTo('93.184.216.34', '2606:2800:220:1::1');

      await expect(subjectUnderTest.assertPublic(new URL('https://careers.example.com/jobs'))).resolves.toBeUndefined();
      expect(lookupMock).toHaveBeenCalledWith('careers.example.com', { all: true });
    });

    it('refuses a host when any of its addresses is private', async () => {
      resolveTo('93.184.216.34', '127.0.0.1');

      await expect(subjectUnderTest.assertPublic(new URL('http://rebind.example.com/'))).rejects.toMatchObject({
        code: CrawlErrorCodeEnum.PRIVATE_ADDRESS,
        message: 'PRIVATE_ADDRESS: rebind.example.com resolves to 127.0.0.1'
      });
    });

    it('strips the brackets of an IPv6 host before resolving it', async () => {
      resolveTo('::1');

      await expect(subjectUnderTest.assertPublic(new URL('http://[::1]:8080/'))).rejects.toMatchObject({
        code: CrawlErrorCodeEnum.PRIVATE_ADDRESS
      });
      expect(lookupMock).toHaveBeenCalledWith('::1', { all: true });
    });

    it('turns a host that does not resolve into a retryable failure', async () => {
      lookupMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND nowhere.example'));

      await expect(subjectUnderTest.assertPublic(new URL('https://nowhere.example/'))).rejects.toMatchObject({
        code: CrawlErrorCodeEnum.FETCH_FAILED,
        isRetryable: true
      });
    });
  });

  describe('isPublic', () => {
    it('is true for public addresses only', async () => {
      resolveTo('93.184.216.34');

      await expect(subjectUnderTest.isPublic(new URL('https://careers.example.com/'))).resolves.toBe(true);
    });

    it('is false for a private address', async () => {
      resolveTo('192.168.0.10');

      await expect(subjectUnderTest.isPublic(new URL('http://router.example/'))).resolves.toBe(false);
    });

    it('is false for a host that does not resolve', async () => {
      lookupMock.mockRejectedValue(new Error('ENOTFOUND'));

      await expect(subjectUnderTest.isPublic(new URL('https://nowhere.example/'))).resolves.toBe(false);
    });
  });
});
