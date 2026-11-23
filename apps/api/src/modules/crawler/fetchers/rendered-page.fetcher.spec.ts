import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Route, chromium, errors } from 'playwright';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SourceFetchModeEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { BrowserChannelEnum } from '../enums/browser-channel.enum.js';
import { AddressGuardService } from '../services/address-guard.service.js';
import { RenderedPageFetcher } from './rendered-page.fetcher.js';

vi.mock('playwright', () => {
  /**
   * The timeout error of Playwright
   */
  class TimeoutError extends Error {}

  return { chromium: { launch: vi.fn() }, errors: { TimeoutError } };
});

const MAX_SCROLLS = 3;
const USER_AGENT = 'Mozilla/5.0 (fictional)';

/**
 * The parts of a Playwright page the fetcher uses
 */
interface IFakePage {
  readonly goto: ReturnType<typeof vi.fn>;
  readonly waitForLoadState: ReturnType<typeof vi.fn>;
  readonly waitForFunction: ReturnType<typeof vi.fn>;
  readonly locator: ReturnType<typeof vi.fn>;
  readonly mouse: { readonly wheel: ReturnType<typeof vi.fn> };
  readonly url: ReturnType<typeof vi.fn>;
  readonly content: ReturnType<typeof vi.fn>;
}

/**
 * A page that loads at once and has no more links after a scroll
 *
 * @returns {IFakePage}
 */
function fakePage(): IFakePage {
  return {
    goto: vi.fn().mockResolvedValue({ status: () => 200, headers: () => ({ 'content-type': 'text/html' }) }),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForFunction: vi.fn().mockRejectedValue(new errors.TimeoutError('no more links')),
    locator: vi.fn().mockReturnValue({ count: vi.fn().mockResolvedValue(5) }),
    mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
    url: vi.fn().mockReturnValue('https://careers.example.com/jobs'),
    content: vi.fn().mockResolvedValue('<html>rendered</html>')
  };
}

/**
 * A route of a request of the given URL and resource type
 *
 * @param {string} url
 * @param {string} resourceType
 *
 * @returns {Route}
 */
function routeOf(url: string, resourceType = 'document'): Route {
  return {
    request: () => ({ url: () => url, resourceType: () => resourceType }),
    abort: vi.fn().mockResolvedValue(undefined),
    continue: vi.fn().mockResolvedValue(undefined)
  } as unknown as Route;
}

describe('RenderedPageFetcher (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: RenderedPageFetcher;
  let guard: DeepMocked<AddressGuardService>;
  let page: IFakePage;
  let context: { route: ReturnType<typeof vi.fn>; newPage: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let browser: {
    newContext: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    version: () => string;
  };
  const launch = vi.mocked(chromium.launch);

  /**
   * The route handler the fetcher installed on the context
   *
   * @returns {(route: Route) => Promise<void>}
   */
  function routeHandler(): (route: Route) => Promise<void> {
    return context.route.mock.calls[0]?.[1] as (route: Route) => Promise<void>;
  }

  beforeEach(async () => {
    page = fakePage();
    context = {
      route: vi.fn().mockResolvedValue(undefined),
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn().mockResolvedValue(undefined)
    };
    browser = {
      newContext: vi.fn().mockResolvedValue(context),
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      version: () => '157.0'
    };
    launch.mockReset();
    launch.mockResolvedValue(browser as never);
    guard = createMock<AddressGuardService>();
    guard.isPublic.mockResolvedValue(true);
    moduleFixture = await Test.createTestingModule({
      providers: [
        RenderedPageFetcher,
        { provide: AddressGuardService, useValue: guard },
        {
          provide: ConfigService,
          useValue: createConfigMock({
            RENDER_BROWSER_CHANNEL: BrowserChannelEnum.CHROME,
            RENDER_TIMEOUT_MS: 10_000,
            RENDER_SCROLL_WAIT_MS: 100,
            RENDER_MAX_SCROLLS: MAX_SCROLLS,
            HTTP_USER_AGENT: USER_AGENT
          })
        }
      ]
    }).compile();

    subjectUnderTest = moduleFixture.get(RenderedPageFetcher);
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined and serve the rendered mode', () => {
    expect(subjectUnderTest).toBeDefined();
    expect(subjectUnderTest.mode).toBe(SourceFetchModeEnum.RENDERED);
  });

  describe('fetch', () => {
    it('renders the page in a fresh context with the configured browser and User-Agent, then closes the context', async () => {
      const result = await subjectUnderTest.fetch(new URL('https://careers.example.com/jobs'));

      expect(result).toEqual({
        url: 'https://careers.example.com/jobs',
        status: 200,
        headers: { 'content-type': 'text/html' },
        html: '<html>rendered</html>'
      });
      expect(launch).toHaveBeenCalledWith({ headless: true, channel: BrowserChannelEnum.CHROME });
      expect(browser.newContext).toHaveBeenCalledWith({ userAgent: USER_AGENT, locale: 'en-US' });
      expect(page.goto).toHaveBeenCalledWith('https://careers.example.com/jobs', { waitUntil: 'load', timeout: 10_000 });
      expect(context.close).toHaveBeenCalled();
    });

    it('reports status 0 and no headers when the navigation gave no response', async () => {
      page.goto.mockResolvedValue(null);

      await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/jobs'))).resolves.toMatchObject({ status: 0, headers: {} });
    });

    it('starts the browser once for several pages', async () => {
      await subjectUnderTest.fetch(new URL('https://careers.example.com/a'));
      await subjectUnderTest.fetch(new URL('https://careers.example.com/b'));

      expect(launch).toHaveBeenCalledTimes(1);
      expect(browser.newContext).toHaveBeenCalledTimes(2);
    });

    it('tries to start the browser again after a failed start', async () => {
      launch.mockRejectedValueOnce(new Error('Chromium distribution not found'));

      await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/a'))).rejects.toThrow('Chromium distribution not found');
      await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/a'))).resolves.toBeDefined();
      expect(launch).toHaveBeenCalledTimes(2);
    });

    it('starts a new browser after the old one disconnected', async () => {
      await subjectUnderTest.fetch(new URL('https://careers.example.com/a'));

      const onDisconnected = browser.on.mock.calls.find(([event]) => event === 'disconnected')?.[1] as () => void;

      onDisconnected();
      await subjectUnderTest.fetch(new URL('https://careers.example.com/b'));

      expect(launch).toHaveBeenCalledTimes(2);
    });

    it('closes the context when the page fails to load', async () => {
      page.goto.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

      await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/a'))).rejects.toThrow('ERR_NAME_NOT_RESOLVED');
      expect(context.close).toHaveBeenCalled();
    });

    it('accepts a network that never goes quiet, but not another error while settling', async () => {
      page.waitForLoadState.mockRejectedValueOnce(new errors.TimeoutError('still polling'));

      await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/a'))).resolves.toBeDefined();

      page.waitForLoadState.mockRejectedValueOnce(new Error('Target closed'));

      await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/a'))).rejects.toThrow('Target closed');
    });

    it('scrolls while new links appear and stops at the first scroll without new ones', async () => {
      page.waitForFunction.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new errors.TimeoutError('no more'));

      await subjectUnderTest.fetch(new URL('https://careers.example.com/a'));

      expect(page.mouse.wheel).toHaveBeenCalledTimes(2);
      expect(page.waitForFunction).toHaveBeenCalledWith("document.querySelectorAll('a[href]').length > 5", undefined, { timeout: 100 });
    });

    it('scrolls no more than the configured number of times', async () => {
      page.waitForFunction.mockResolvedValue(undefined);

      await subjectUnderTest.fetch(new URL('https://careers.example.com/a'));

      expect(page.mouse.wheel).toHaveBeenCalledTimes(MAX_SCROLLS);
    });

    it('passes on an error of the page other than a timeout while scrolling', async () => {
      page.waitForFunction.mockRejectedValue(new Error('Execution context was destroyed'));

      await expect(subjectUnderTest.fetch(new URL('https://careers.example.com/a'))).rejects.toThrow('Execution context was destroyed');
    });
  });

  describe('requests of the page', () => {
    beforeEach(async () => {
      await subjectUnderTest.fetch(new URL('https://careers.example.com/jobs'));
    });

    it.each(['image', 'media', 'font'])('aborts a %s without a lookup', async resourceType => {
      const route = routeOf('https://cdn.example.com/x', resourceType);

      await routeHandler()(route);

      expect(route.abort).toHaveBeenCalledWith();
      expect(guard.isPublic).not.toHaveBeenCalled();
    });

    it('lets a request that does not go over the network through', async () => {
      const route = routeOf('data:text/html,<p>hi</p>');

      await routeHandler()(route);

      expect(route.continue).toHaveBeenCalled();
      expect(guard.isPublic).not.toHaveBeenCalled();
    });

    it('lets a request to a public host through', async () => {
      const route = routeOf('https://api.example.com/jobs.json', 'fetch');

      await routeHandler()(route);

      expect(route.continue).toHaveBeenCalled();
    });

    it('aborts a request to a private address, a websocket too', async () => {
      guard.isPublic.mockResolvedValue(false);

      for (const url of ['http://127.0.0.1:3999/queues', 'ws://localhost:6379/']) {
        const route = routeOf(url, 'xhr');

        await routeHandler()(route);

        expect(route.abort).toHaveBeenCalledWith('blockedbyclient');
        expect(route.continue).not.toHaveBeenCalled();
      }
    });

    it('resolves each host once for the whole page', async () => {
      await routeHandler()(routeOf('https://api.example.com/a', 'fetch'));
      await routeHandler()(routeOf('https://api.example.com/b', 'fetch'));

      expect(guard.isPublic).toHaveBeenCalledTimes(1);
    });
  });

  describe('onApplicationShutdown', () => {
    it('does nothing when the browser never started', async () => {
      await expect(subjectUnderTest.onApplicationShutdown()).resolves.toBeUndefined();
      expect(browser.close).not.toHaveBeenCalled();
    });

    it('closes a running browser', async () => {
      await subjectUnderTest.fetch(new URL('https://careers.example.com/a'));
      await subjectUnderTest.onApplicationShutdown();

      expect(browser.close).toHaveBeenCalled();
    });
  });
});
