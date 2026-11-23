import type { DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { envSchema } from './env.schema.js';

/**
 * Global configuration validated by the env schema — shared by the HTTP application and the commands.
 * The environment comes from the process (`node --env-file`, Docker), never from a file the module reads
 *
 * @returns {Promise<DynamicModule>}
 */
export async function createConfigModule(): Promise<DynamicModule> {
  return ConfigModule.forRoot({ isGlobal: true, cache: true, ignoreEnvFile: true, validationSchema: envSchema });
}
