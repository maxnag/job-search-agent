import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';

import type { IEnv } from '../src/config/env.schema.js';

/**
 * A real ConfigService whose `get` answers by key from the given values — a key switch, never one value for all keys
 *
 * @param {Partial<Record<keyof IEnv, unknown>>} env
 *
 * @returns {ConfigService<IEnv, true>}
 */
export function createConfigMock(env: Partial<Record<keyof IEnv, unknown>>): ConfigService<IEnv, true> {
  const configService = new ConfigService<IEnv, true>();

  vi.spyOn(configService, 'get').mockImplementation((key: string) => env[key as keyof IEnv]);

  return configService;
}
