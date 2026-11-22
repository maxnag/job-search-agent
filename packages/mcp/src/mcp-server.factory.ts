import { readFileSync } from 'node:fs';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import type { MCPServerNameEnum } from './mcp-server-name.enum.js';

/**
 * Prefix of every server name the MCP clients see
 *
 * @type {string}
 */
const SERVER_NAME_PREFIX = 'job-agent';

/**
 * Read the package version reported in the `initialize` response
 *
 * @returns {string}
 */
function readPackageVersion(): string {
  const manifest: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  return z.object({ version: z.string() }).parse(manifest).version;
}

/**
 * Create an MCP server and serve it over stdio.
 * stdout belongs to the protocol, so the server writes its own messages to stderr only
 *
 * @param {MCPServerNameEnum} name
 *
 * @returns {Promise<McpServer>}
 */
export async function startStdioServer(name: MCPServerNameEnum): Promise<McpServer> {
  const server = new McpServer({ name: `${SERVER_NAME_PREFIX}-${name}`, version: readPackageVersion() });

  await server.connect(new StdioServerTransport());
  console.error(`MCP server ${name} is serving on stdio`);

  return server;
}
