import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

/**
 * Runs the Next.js CLI on the address of the web UI: the loopback and WEB_PORT from the root .env.
 * NODE_ENV of the root .env is dropped — Next sets it for each command itself.
 */
const NEXT_BIN = createRequire(import.meta.url).resolve('next/dist/bin/next');
const [command, ...rest] = process.argv.slice(2);
const address = command === 'build' ? [] : ['--hostname', process.env.WEB_HOST ?? '127.0.0.1', '--port', process.env.WEB_PORT ?? '3001'];
const env = { ...process.env };

delete env.NODE_ENV;

const child = spawn(process.execPath, [NEXT_BIN, command, ...address, ...rest], { stdio: 'inherit', env });

child.on('exit', code => process.exit(code ?? 1));
