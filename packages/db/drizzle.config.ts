import { existsSync } from 'node:fs';

import { defineConfig } from 'drizzle-kit';

const ENV_FILE = '../../.env';

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ''
  },
  migrations: {
    schema: 'drizzle',
    table: '__drizzle_migrations'
  }
});
