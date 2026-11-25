import type { CallToolResult, McpServer } from '@job-agent/mcp';

/**
 * What a tool found: the data the client gets as `structuredContent` and a one-line summary of it
 */
export interface IToolAnswer {
  /**
   * Data, matching the `outputSchema` of the tool
   *
   * @var {Record<string, unknown>}
   */
  readonly data: Record<string, unknown>;

  /**
   * One line about the data
   *
   * @var {string}
   */
  readonly summary: string;
}

/**
 * Runs the work of a tool and turns its outcome into the answer of the call: the data, or an error with a code
 */
export interface IToolRunner {
  /**
   * @param {string} tool
   * @param {() => Promise<IToolAnswer>} work
   *
   * @returns {Promise<CallToolResult>}
   */
  (tool: string, work: () => Promise<IToolAnswer>): Promise<CallToolResult>;
}

/**
 * A tool of the `jobs-db` server: registers itself with its schemas, its work run by the runner
 */
export interface IJobsDBTool {
  /**
   * Register the tool on the server
   *
   * @param {McpServer} server
   * @param {IToolRunner} run
   *
   * @returns {void}
   */
  register(server: McpServer, run: IToolRunner): void;
}
