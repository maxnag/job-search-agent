import { z } from 'zod';

/**
 * Environment of the standalone database scripts: migrations and seeds
 */
export const dbEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  DATABASE_URL_TEST: z.url().optional(),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000)
});

/**
 * Validated environment of the database scripts
 */
export type IDBEnv = z.infer<typeof dbEnvSchema>;

/**
 * Validate the environment of a database script, naming every invalid key
 *
 * @param {NodeJS.ProcessEnv} env
 *
 * @throws {Error} If a key is missing or invalid
 *
 * @returns {IDBEnv}
 */
export function parseDBEnv(env: NodeJS.ProcessEnv): IDBEnv {
  const result = dbEnvSchema.safeParse(env);

  if (!result.success) {
    const keys = result.error.issues.map(issue => issue.path.join('.')).join(', ');

    throw new Error(`DB_ENV_INVALID: missing or invalid keys: ${keys}`);
  }

  return result.data;
}
