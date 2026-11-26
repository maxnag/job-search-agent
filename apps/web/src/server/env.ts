import 'server-only';
import { z } from 'zod';

/**
 * Settings of the web server, read once on start; the browser never sees them
 */
const envSchema = z.object({
  WEB_API_URL: z.url().default('http://127.0.0.1:3000'),
  WEB_API_TIMEOUT_MS: z.coerce.number().int().positive().default(5000)
});

/**
 * Validated settings of the web server
 *
 * @type {{ WEB_API_URL: string, WEB_API_TIMEOUT_MS: number }}
 */
export const webEnv = envSchema.parse(process.env);
