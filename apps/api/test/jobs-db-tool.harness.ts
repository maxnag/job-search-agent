import { isDeepStrictEqual } from 'node:util';

import { createMock } from '@golevelup/ts-vitest';
import { z } from 'zod';

import { type CallToolResult, type McpServer, type ToolAnnotations, toolResult } from '@job-agent/mcp';

import type { IJobsDBTool, IToolAnswer } from '../src/modules/jobs-db/interfaces/jobs-db-tool.interface.js';

/**
 * What a tool passes to `registerTool`
 */
interface IToolRegistration {
  /**
   * Name of the tool
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * Its settings: description, schemas, hints
   *
   * @var {object}
   */
  readonly config: {
    readonly title: string;
    readonly description: string;
    readonly inputSchema: Record<string, z.ZodType>;
    readonly outputSchema: Record<string, z.ZodType>;
    readonly annotations: ToolAnnotations;
  };

  /**
   * Its handler, as the SDK calls it with the validated input
   *
   * @var {(input: unknown, extra: unknown) => Promise<CallToolResult>}
   */
  readonly callback: (input: unknown, extra: unknown) => Promise<CallToolResult>;
}

/**
 * A tool registered on a mocked server: its name, description and hints, and a call that goes through its schemas
 */
export interface IRegisteredJobsDBTool {
  /**
   * Name of the tool
   *
   * @var {string}
   */
  readonly name: string;

  /**
   * Description the model reads
   *
   * @var {string}
   */
  readonly description: string;

  /**
   * Hints of the tool
   *
   * @var {ToolAnnotations}
   */
  readonly annotations: ToolAnnotations;

  /**
   * Whether the input schema accepts the input
   *
   * @param {Record<string, unknown>} input
   *
   * @returns {boolean}
   */
  accepts(input: Record<string, unknown>): boolean;

  /**
   * Call the tool as the SDK does: the input parsed by its schema, defaults applied; the data checked against the
   * output schema, no field outside it. A refusal or a failure of the work is thrown as is
   *
   * @param {Record<string, unknown>} [input]
   *
   * @returns {Promise<IToolAnswer>}
   */
  call(input?: Record<string, unknown>): Promise<IToolAnswer>;
}

/**
 * Register a tool on a mocked server, its work run without the error handling of the service
 *
 * @param {IJobsDBTool} tool
 *
 * @throws {Error} If the tool registers nothing
 *
 * @returns {IRegisteredJobsDBTool}
 */
export function registerJobsDBTool(tool: IJobsDBTool): IRegisteredJobsDBTool {
  const server = createMock<McpServer>();

  tool.register(server, async (_name, work) => {
    const answer = await work();

    return toolResult(answer.data, answer.summary);
  });

  const [call] = server.registerTool.mock.calls;

  if (call === undefined) {
    throw new Error('The tool registered nothing');
  }

  const [name, config, callback] = call as unknown as [
    IToolRegistration['name'],
    IToolRegistration['config'],
    IToolRegistration['callback']
  ];
  const input = z.object(config.inputSchema).strict();
  const output = z.object(config.outputSchema).strict();

  return {
    name,
    description: config.description,
    annotations: config.annotations,
    accepts: value => input.safeParse(value).success,
    call: async (value = {}) => {
      const result = await callback(input.parse(value), {});
      const data = result.structuredContent ?? {};

      if (!isDeepStrictEqual(output.parse(data), data)) {
        throw new Error(`${name} answered with fields outside its output schema`);
      }

      const [content] = result.content;

      return { data, summary: content?.type === 'text' ? (content.text.split('\n')[0] ?? '') : '' };
    }
  };
}
