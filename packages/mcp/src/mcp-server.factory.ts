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
 * Signals a client or the shell stops the server with
 *
 * @type {readonly NodeJS.Signals[]}
 */
const STOP_SIGNALS: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

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
 * Close the server and then whatever it was serving from, once — whichever comes first: the client closes stdin or a
 * stop signal arrives
 *
 * @param {MCPServerNameEnum} name
 * @param {McpServer} server
 * @param {() => Promise<void>} onClose
 *
 * @returns {void}
 */
function closeOnStop(name: MCPServerNameEnum, server: McpServer, onClose: () => Promise<void>): void {
  let closing = false;

  const close = async (): Promise<void> => {
    if (closing) {
      return;
    }

    closing = true;

    try {
      await server.close();
      await onClose();
    } catch (error) {
      console.error(`MCP server ${name} did not close cleanly: ${error instanceof Error ? error.message : 'unknown error'}`);
      process.exitCode = 1;
    }
  };

  process.stdin.once('end', () => void close());

  for (const signal of STOP_SIGNALS) {
    process.once(signal, () => void close());
  }
}

/**
 * Create an MCP server, let the caller register its tools and serve it over stdio until the client goes away.
 * stdout belongs to the protocol, so the server writes its own messages to stderr only
 *
 * @param {MCPServerNameEnum} name
 * @param {(server: McpServer) => void} registerTools
 * @param {() => Promise<void>} [onClose] Releases what the tools use (a database pool) after the server closed
 *
 * @returns {Promise<McpServer>}
 */
export async function startStdioServer(
  name: MCPServerNameEnum,
  registerTools: (server: McpServer) => void,
  onClose: () => Promise<void> = () => Promise.resolve()
): Promise<McpServer> {
  const server = new McpServer({ name: `${SERVER_NAME_PREFIX}-${name}`, version: readPackageVersion() });

  registerTools(server);
  closeOnStop(name, server, onClose);
  await server.connect(new StdioServerTransport());
  console.error(`MCP server ${name} is serving on stdio`);

  return server;
}
