import { Global, Module } from '@nestjs/common';

import { DatabaseService } from './services/database.service.js';

/**
 * Postgres access for every module — repositories inject `DatabaseService`
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService]
})
export class DatabaseModule {}
