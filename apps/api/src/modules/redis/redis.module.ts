import { Global, Module } from '@nestjs/common';

import { RedisService } from './services/redis.service.js';

/**
 * The application's own Redis connection
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService]
})
export class RedisModule {}
