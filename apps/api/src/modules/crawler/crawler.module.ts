import { Module } from '@nestjs/common';

import { HTMLPageFetcher } from './fetchers/h-t-m-l-page.fetcher.js';
import { RenderedPageFetcher } from './fetchers/rendered-page.fetcher.js';
import type { IPageFetcher } from './interfaces/page-fetcher.interface.js';
import { AddressGuardService } from './services/address-guard.service.js';
import { CrawlerService } from './services/crawler.service.js';
import { HostThrottleService } from './services/host-throttle.service.js';
import { PageFetcherRegistry } from './services/page-fetcher.registry.js';
import { RobotsService } from './services/robots.service.js';

/**
 * Polite crawling of career pages: robots.txt, one request at a time per site, a fetcher per `source_fetch_mode`
 */
@Module({
  providers: [
    AddressGuardService,
    HTMLPageFetcher,
    RenderedPageFetcher,
    {
      provide: PageFetcherRegistry,
      inject: [HTMLPageFetcher, RenderedPageFetcher],
      useFactory: (...fetchers: IPageFetcher[]) => new PageFetcherRegistry(fetchers)
    },
    HostThrottleService,
    RobotsService,
    CrawlerService
  ],
  exports: [CrawlerService]
})
export class CrawlerModule {}
