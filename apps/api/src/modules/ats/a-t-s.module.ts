import { Module } from '@nestjs/common';

import { CrawlerModule } from '../crawler/crawler.module.js';
import { ComeetClient } from './clients/comeet.client.js';
import { GreenhouseClient } from './clients/greenhouse.client.js';
import { LeverClient } from './clients/lever.client.js';
import type { IATSClient } from './interfaces/a-t-s-client.interface.js';
import { ATSClientRegistry } from './services/a-t-s-client.registry.js';

/**
 * Public job boards of applicant tracking systems (Comeet, Greenhouse, Lever), read through the polite crawler
 */
@Module({
  imports: [CrawlerModule],
  providers: [
    ComeetClient,
    GreenhouseClient,
    LeverClient,
    {
      provide: ATSClientRegistry,
      inject: [ComeetClient, GreenhouseClient, LeverClient],
      useFactory: (...clients: IATSClient[]) => new ATSClientRegistry(clients)
    }
  ],
  exports: [ATSClientRegistry]
})
export class ATSModule {}
