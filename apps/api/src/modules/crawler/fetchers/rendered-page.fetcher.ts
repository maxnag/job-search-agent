import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Browser, type BrowserContext, type Page, type Route, chromium, errors } from 'playwright';

import { SourceFetchModeEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import type { IFetchedPage } from '../interfaces/fetched-page.interface.js';
import type { IPageFetcher } from '../interfaces/page-fetcher.interface.js';
import type { IScrollResult } from '../interfaces/scroll-result.interface.js';
import { AddressGuardService } from '../services/address-guard.service.js';

/**
 * Resources a list of vacancies does not need — not downloaded, the site serves less
 *
 * @type {ReadonlySet<string>}
 */
const SKIPPED_RESOURCES: ReadonlySet<string> = new Set(['image', 'media', 'font']);

/**
 * Protocols of a request that goes over the network — `data:` and `blob:` do not
 *
 * @type {ReadonlySet<string>}
 */
const NETWORK_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'ws:', 'wss:']);

/**
 * How far one scroll moves — beyond any page height, so it lands at the bottom
 *
 * @type {number}
 */
const SCROLL_STEP_PX = 100000;

/**
 * Locale of the browser context — the working language of the search
 *
 * @type {string}
 */
const LOCALE = 'en-US';

/**
 * Loads a page in a headless browser and scrolls it while the number of links grows — for lists drawn by JavaScript
 * or loaded on scroll. One browser per process, started on first use; one context per page
 */
@Injectable()
export class RenderedPageFetcher implements IPageFetcher, OnApplicationShutdown {
  /**
   * The mode it serves
   *
   * @var {SourceFetchModeEnum}
   */
  readonly mode = SourceFetchModeEnum.RENDERED;

  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(RenderedPageFetcher.name);

  /**
   * The browser being started or running; cleared when it fails to start or disconnects
   *
   * @var {Promise<Browser> | undefined}
   */
  private browser?: Promise<Browser>;

  /**
   * @param {AddressGuardService} addressGuardService
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly addressGuardService: AddressGuardService,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * Open the page, wait for the network to settle, scroll while new links appear, return the rendered HTML — `partial`
   * when the scrolling stopped before the links stopped growing
   *
   * @param {URL} url
   * @param {number} [limitMs] Limit instead of `RENDER_TIMEOUT_MS`
   *
   * @throws {Error} If the browser does not start or the page does not load within the limit
   *
   * @returns {Promise<IFetchedPage>}
   */
  async fetch(url: URL, limitMs?: number): Promise<IFetchedPage> {
    const browser = await this.launch();
    const context = await this.createContext(browser);
    const timeoutMs = limitMs ?? this.configService.get('RENDER_TIMEOUT_MS', { infer: true });
    const deadline = Date.now() + timeoutMs;

    try {
      const page = await context.newPage();
      const response = await page.goto(url.href, { waitUntil: 'load', timeout: timeoutMs });

      await this.settle(page, deadline);

      const { scrolls, partial } = await this.scrollWhileLinksGrow(page, deadline);

      this.logger.debug({ message: 'Page rendered', host: url.host, scrolls, partial });

      return {
        url: page.url(),
        status: response?.status() ?? 0,
        headers: response?.headers() ?? {},
        html: await page.content(),
        partial
      };
    } finally {
      await context.close();
    }
  }

  /**
   * Close the browser
   *
   * @returns {Promise<void>}
   */
  async onApplicationShutdown(): Promise<void> {
    if (!this.browser) {
      return;
    }

    const [started] = await Promise.allSettled([this.browser]);

    if (started.status === 'fulfilled') {
      await started.value.close();
    }
  }

  /**
   * The running browser, started on first use
   *
   * @returns {Promise<Browser>}
   */
  private async launch(): Promise<Browser> {
    this.browser ??= this.start();

    return this.browser;
  }

  /**
   * Start the browser — Playwright's own, or the system one of `RENDER_BROWSER_CHANNEL`
   *
   * @throws {Error} If the browser cannot start; the next page tries again
   *
   * @returns {Promise<Browser>}
   */
  private async start(): Promise<Browser> {
    const channel = this.configService.get('RENDER_BROWSER_CHANNEL', { infer: true });

    try {
      const browser = await chromium.launch({ headless: true, channel });

      browser.on('disconnected', () => {
        this.browser = undefined;
      });

      this.logger.log({ message: 'Browser started', channel: channel ?? 'playwright', version: browser.version() });

      return browser;
    } catch (error) {
      this.browser = undefined;

      throw error;
    }
  }

  /**
   * A fresh context with the configured User-Agent — the headless one names itself `HeadlessChrome` — that skips
   * images, media and fonts and never lets the page reach a private address
   *
   * @param {Browser} browser
   *
   * @returns {Promise<BrowserContext>}
   */
  private async createContext(browser: Browser): Promise<BrowserContext> {
    const context = await browser.newContext({ userAgent: this.configService.get('HTTP_USER_AGENT', { infer: true }), locale: LOCALE });
    const publicHosts = new Map<string, Promise<boolean>>();

    await context.route('**/*', async route => this.routeRequest(route, publicHosts));

    return context;
  }

  /**
   * Let a request of the page through, or abort it: a skipped resource, or a host that resolves to a private address
   * — one lookup per host for the whole page
   *
   * @param {Route} route
   * @param {Map<string, Promise<boolean>>} publicHosts
   *
   * @returns {Promise<void>}
   */
  private async routeRequest(route: Route, publicHosts: Map<string, Promise<boolean>>): Promise<void> {
    const request = route.request();

    if (SKIPPED_RESOURCES.has(request.resourceType())) {
      return route.abort();
    }

    const url = URL.parse(request.url());

    if (!url || !NETWORK_PROTOCOLS.has(url.protocol)) {
      return route.continue();
    }

    let isPublic = publicHosts.get(url.hostname);

    if (!isPublic) {
      isPublic = this.addressGuardService.isPublic(url);
      publicHosts.set(url.hostname, isPublic);
    }

    if (await isPublic) {
      return route.continue();
    }

    this.logger.debug({ message: 'Request to a private address aborted', host: url.host });

    return route.abort('blockedbyclient');
  }

  /**
   * Wait for the network to go quiet, no longer than one scroll wait — pages that poll never go quiet
   *
   * @param {Page} page
   * @param {number} deadline
   *
   * @returns {Promise<void>}
   */
  private async settle(page: Page, deadline: number): Promise<void> {
    const timeout = Math.min(this.configService.get('RENDER_SCROLL_WAIT_MS', { infer: true }), deadline - Date.now());

    if (timeout <= 0) {
      return;
    }

    try {
      await page.waitForLoadState('networkidle', { timeout });
    } catch (error) {
      if (!(error instanceof errors.TimeoutError)) {
        throw error;
      }
    }
  }

  /**
   * Scroll to the bottom and wait for more links, until their number stops growing, `RENDER_MAX_SCROLLS` is reached
   * or the deadline passes. Only a full `RENDER_SCROLL_WAIT_MS` without a new link ends the list; a wait the deadline
   * cut short proves nothing, so it leaves the result partial
   *
   * @param {Page} page
   * @param {number} deadline
   *
   * @returns {Promise<IScrollResult>}
   */
  private async scrollWhileLinksGrow(page: Page, deadline: number): Promise<IScrollResult> {
    const maxScrolls = this.configService.get('RENDER_MAX_SCROLLS', { infer: true });
    const scrollWaitMs = this.configService.get('RENDER_SCROLL_WAIT_MS', { infer: true });

    for (let scroll = 0; scroll < maxScrolls; scroll++) {
      const timeout = Math.min(scrollWaitMs, deadline - Date.now());

      if (timeout <= 0) {
        return { scrolls: scroll, partial: true };
      }

      const links = await page.locator('a[href]').count();

      await page.mouse.wheel(0, SCROLL_STEP_PX);

      if (!(await this.waitForMoreLinks(page, links, timeout))) {
        return { scrolls: scroll + 1, partial: timeout < scrollWaitMs };
      }
    }

    return { scrolls: maxScrolls, partial: true };
  }

  /**
   * Whether the page gains links within the timeout
   *
   * @param {Page} page
   * @param {number} links
   * @param {number} timeout
   *
   * @returns {Promise<boolean>}
   */
  private async waitForMoreLinks(page: Page, links: number, timeout: number): Promise<boolean> {
    try {
      await page.waitForFunction(`document.querySelectorAll('a[href]').length > ${links}`, undefined, { timeout });

      return true;
    } catch (error) {
      if (error instanceof errors.TimeoutError) {
        return false;
      }

      throw error;
    }
  }
}
