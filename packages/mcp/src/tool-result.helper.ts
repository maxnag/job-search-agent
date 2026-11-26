import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * The answer of a tool: the data as `structuredContent`, validated by the SDK against the tool's `outputSchema`, and
 * the same data as JSON text after a one-line summary — a client that reads only `content` still gets all of it
 *
 * @param {Record<string, unknown>} data
 * @param {string} summary
 *
 * @returns {CallToolResult}
 */
export function toolResult(data: Record<string, unknown>, summary: string): CallToolResult {
  return { content: [{ type: 'text', text: `${summary}\n\n${JSON.stringify(data)}` }], structuredContent: data };
}

/**
 * A failed call the client can act on: the error code first, then a sentence for the model — never a stack or a query
 *
 * @param {string} code
 * @param {string} message
 *
 * @returns {CallToolResult}
 */
export function toolError(code: string, message: string): CallToolResult {
  return { content: [{ type: 'text', text: `${code}: ${message}` }], isError: true };
}
