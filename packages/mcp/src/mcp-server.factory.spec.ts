import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MCPServerNameEnum } from './mcp-server-name.enum.js';
import { startStdioServer } from './mcp-server.factory.js';

const mcp = vi.hoisted(() => ({ info: vi.fn(), connect: vi.fn(), transport: vi.fn() }));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    connect = mcp.connect;

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

describe('startStdioServer', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names the server after the project and reports the package version', async () => {
    const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

    await startStdioServer(MCPServerNameEnum.JOBS_DB);

    expect(mcp.info).toHaveBeenCalledWith({ name: 'job-agent-jobs-db', version });
  });

  it('serves over stdio and writes its own message to stderr only', async () => {
    await startStdioServer(MCPServerNameEnum.GMAIL);

    expect(mcp.transport).toHaveBeenCalled();
    expect(mcp.connect).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('MCP server gmail is serving on stdio');
  });
});
