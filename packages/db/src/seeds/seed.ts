import { parseDBEnv } from '../env/db-env.schema.js';
import { REFERENCE_SEEDS } from './reference/index.js';
import { runSeedScript } from './run-seed-script.js';

await runSeedScript(parseDBEnv(process.env), REFERENCE_SEEDS);
