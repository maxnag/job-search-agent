import { parseDBEnv } from '../env/db-env.schema.js';
import { DEV_SEEDS } from './dev/index.js';
import { runSeedScript } from './run-seed-script.js';

const env = parseDBEnv(process.env);

if (env.NODE_ENV === 'production') {
  throw new Error('SEED_DEV_FORBIDDEN: demo data is never written with NODE_ENV=production');
}

await runSeedScript(env, DEV_SEEDS);
