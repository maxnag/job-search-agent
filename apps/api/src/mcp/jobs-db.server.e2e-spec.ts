import { type ChildProcessWithoutNullStreams, execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertTestDatabaseURL } from '@job-agent/db';

/**
 * Root of the repository
 *
 * @type {string}
 */
const ROOT = resolve(import.meta.dirname, '../../../..');

/**
 * The built entry point the clients start
 *
 * @type {string}
 */
const ENTRY = resolve(ROOT, 'apps/api/dist/mcp/jobs-db.server.js');

/**
 * The TypeScript compiler the build runs
 *
 * @type {string}
 */
const TSC = createRequire(import.meta.url).resolve('typescript/bin/tsc');

/**
 * How long the build and one answer may take
 *
 * @type {{ build: number, answer: number }}
 */
const TIMEOUT_MS = { build: 180_000, answer: 15_000 };

/**
 * A JSON-RPC message the server wrote
 */
interface IRPCMessage {
  /**
   * Always "2.0"
   *
   * @var {string}
   */
  readonly jsonrpc: string;

  /**
   * Id of the request it answers
   *
   * @var {number}
   */
  readonly id?: number;

  /**
   * The answer
   *
   * @var {Record<string, unknown>}
   */
  readonly result?: Record<string, unknown>;
}

/**
 * A line of stdout as a JSON-RPC message; nothing for a line that is not one
 *
 * @param {string} line
 *
 * @returns {IRPCMessage | undefined}
 */
function parseMessage(line: string): IRPCMessage | undefined {
  try {
    const message = JSON.parse(line) as IRPCMessage;

    return message.jsonrpc === '2.0' ? message : undefined;
  } catch {
    return undefined;
  }
}

describe('jobs-db MCP server over stdio (e2e)', () => {
  let child: ChildProcessWithoutNullStreams;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const waiting = new Map<number, (message: IRPCMessage) => void>();
  let nextId = 0;

  /**
   * Send a request and wait for its answer
   *
   * @param {string} method
   * @param {Record<string, unknown>} params
   *
   * @returns {Promise<IRPCMessage>}
   */
  async function request(method: string, params: Record<string, unknown> = {}): Promise<IRPCMessage> {
    const id = ++nextId;
    const answer = new Promise<IRPCMessage>((done, fail) => {
      const timer = setTimeout(() => fail(new Error(`No answer to ${method}; stderr: ${stderr.join('')}`)), TIMEOUT_MS.answer);

      waiting.set(id, message => {
        clearTimeout(timer);
        done(message);
      });
    });

    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);

    return answer;
  }

  beforeAll(async () => {
    execFileSync(process.execPath, [TSC, '-b', 'apps/api/tsconfig.build.json'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    child = spawn(process.execPath, [ENTRY], {
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
        OTEL_EXPORTER_OTLP_ENDPOINT: '',
        DATABASE_URL: assertTestDatabaseURL(process.env.DATABASE_URL_TEST)
      }
    });
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
    createInterface({ input: child.stdout }).on('line', line => {
      stdout.push(line);

      const message = parseMessage(line);

      if (message?.id !== undefined) {
        waiting.get(message.id)?.(message);
      }
    });

    await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '0.0.0' } });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  }, TIMEOUT_MS.build);

  afterAll(() => {
    if (child.exitCode === null) {
      child.kill();
    }
  });

  it('lists the seven tools', async () => {
    const answer = await request('tools/list');
    const tools = (answer.result?.tools ?? []) as { name: string }[];

    expect(tools.map(tool => tool.name)).toEqual([
      'find_vacancies',
      'get_vacancy',
      'list_applications',
      'pipeline_summary',
      'list_sources',
      'list_source_candidates',
      'record_action'
    ]);
  });

  it('answers a read and a refusal over the test database', async () => {
    const summary = await request('tools/call', { name: 'pipeline_summary', arguments: { sinceDays: 1 } });
    const missing = await request('tools/call', { name: 'get_vacancy', arguments: { vacancyId: 2_147_483_647 } });

    expect(summary.result?.isError).toBeUndefined();
    expect(summary.result?.structuredContent).toMatchObject({ sinceDays: 1 });
    expect(missing.result).toEqual({
      content: [{ type: 'text', text: 'VACANCY_NOT_FOUND: There is no vacancy 2147483647' }],
      isError: true
    });
  });

  it('writes only JSON-RPC to stdout, its own lines to stderr, and exits cleanly when stdin closes', async () => {
    const exit = once(child, 'exit');

    child.stdin.end();

    const [code] = (await exit) as [number | null];

    expect(code).toBe(0);
    expect(stdout.length).toBeGreaterThan(0);
    expect(stdout.filter(line => parseMessage(line) === undefined)).toEqual([]);
    expect(stderr.join('')).toContain('MCP server jobs-db is serving on stdio');
  });
});
