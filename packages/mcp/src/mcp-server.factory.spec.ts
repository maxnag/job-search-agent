import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MCPServerNameEnum } from './mcp-server-name.enum.js';
import { startStdioServer } from './mcp-server.factory.js';

const mcp = vi.hoisted(() => ({ info: vi.fn(), connect: vi.fn(), close: vi.fn(), transport: vi.fn() }));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    connect = mcp.connect;

    close = mcp.close;

    constructor(info: unknown) {
      mcp.info(info);
    }
  }
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class {
    constructor() {
      mcp.transport();
    }
  }
}));

/**
 * The events the server listens to for its stop, with the listeners present before a test
 *
 * @type {readonly [NodeJS.EventEmitter, string][]}
 */
const STOP_EVENTS: readonly [NodeJS.EventEmitter, string][] = [
  [process.stdin, 'end'],
  [process, 'SIGINT'],
  [process, 'SIGTERM']
];

describe('startStdioServer', () => {
  let listenersBefore: ((...args: unknown[]) => void)[][];
  let exitCodeBefore: typeof process.exitCode;

  beforeEach(() => {
    listenersBefore = STOP_EVENTS.map(([emitter, event]) => emitter.listeners(event) as ((...args: unknown[]) => void)[]);
    exitCodeBefore = process.exitCode;
    mcp.close.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    STOP_EVENTS.forEach(([emitter, event], index) => {
      for (const listener of emitter.listeners(event)) {
        if (!listenersBefore[index]?.includes(listener as (...args: unknown[]) => void)) {
          emitter.removeListener(event, listener as (...args: unknown[]) => void);
        }
      }
    });
    process.exitCode = exitCodeBefore;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('names the server after the project and reports the package version', async () => {
    const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

    await startStdioServer(MCPServerNameEnum.JOBS_DB, () => undefined);

    expect(mcp.info).toHaveBeenCalledWith({ name: 'job-agent-jobs-db', version });
  });

  it('lets the caller register its tools before it serves over stdio, its own message to stderr only', async () => {
    const registerTools = vi.fn();

    const server = await startStdioServer(MCPServerNameEnum.JOBS_DB, registerTools);

    expect(registerTools).toHaveBeenCalledWith(server);
    expect(registerTools.mock.invocationCallOrder[0]).toBeLessThan(mcp.connect.mock.invocationCallOrder[0] ?? 0);
    expect(mcp.transport).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('MCP server jobs-db is serving on stdio');
  });

  it.each(STOP_EVENTS.map(([, event]) => event))('closes the server, then what it served from, once on %s', async event => {
    const onClose = vi.fn().mockResolvedValue(undefined);

    await startStdioServer(MCPServerNameEnum.JOBS_DB, () => undefined, onClose);

    const emitter: NodeJS.EventEmitter = STOP_EVENTS.find(([, name]) => name === event)?.[0] ?? process;

    emitter.emit(event);
    process.stdin.emit('end');

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mcp.close).toHaveBeenCalledTimes(1);
    expect(mcp.close.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0] ?? 0);
  });

  it('closes without a release of its own when none is given', async () => {
    await startStdioServer(MCPServerNameEnum.JOBS_DB, () => undefined);

    process.stdin.emit('end');

    await vi.waitFor(() => expect(mcp.close).toHaveBeenCalledTimes(1));
    expect(process.exitCode).toBe(exitCodeBefore);
  });

  it('reports a close that failed to stderr and exits with an error', async () => {
    const onClose = vi.fn().mockRejectedValue(new Error('pool already ended'));

    await startStdioServer(MCPServerNameEnum.JOBS_DB, () => undefined, onClose);

    process.emit('SIGTERM');

    await vi.waitFor(() => expect(process.exitCode).toBe(1));
    expect(console.error).toHaveBeenCalledWith('MCP server jobs-db did not close cleanly: pool already ended');
  });

  it('reports a failure that is not an error as unknown', async () => {
    mcp.close.mockRejectedValue('closed twice');

    await startStdioServer(MCPServerNameEnum.JOBS_DB, () => undefined);

    process.emit('SIGINT');

    await vi.waitFor(() => expect(console.error).toHaveBeenCalledWith('MCP server jobs-db did not close cleanly: unknown error'));
  });
});
