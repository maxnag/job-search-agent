import { Injectable, Logger } from '@nestjs/common';

import { type CallToolResult, type McpServer, toolError, toolResult } from '@job-agent/mcp';

import { JobsDBErrorCodeEnum } from '../enums/jobs-db-error-code.enum.js';
import { JobsDBToolError } from '../errors/jobs-db-tool.error.js';
import type { IJobsDBTool, IToolAnswer } from '../interfaces/jobs-db-tool.interface.js';
import { FindVacanciesTool } from '../tools/find-vacancies.tool.js';
import { GetVacancyTool } from '../tools/get-vacancy.tool.js';
import { ListApplicationsTool } from '../tools/list-applications.tool.js';
import { ListSourceCandidatesTool } from '../tools/list-source-candidates.tool.js';
import { ListSourcesTool } from '../tools/list-sources.tool.js';
import { PipelineSummaryTool } from '../tools/pipeline-summary.tool.js';
import { RecordActionTool } from '../tools/record-action.tool.js';

/**
 * The tools of the `jobs-db` MCP server: registers them and answers every call — the data, or an error with a code;
 * an unexpected failure is logged here, the client gets only its code
 */
@Injectable()
export class JobsDBToolsService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(JobsDBToolsService.name);

  /**
   * Every tool, in the order `tools/list` shows them
   *
   * @var {readonly IJobsDBTool[]}
   */
  private readonly tools: readonly IJobsDBTool[];

  /**
   * @param {FindVacanciesTool} findVacanciesTool
   * @param {GetVacancyTool} getVacancyTool
   * @param {ListApplicationsTool} listApplicationsTool
   * @param {PipelineSummaryTool} pipelineSummaryTool
   * @param {ListSourcesTool} listSourcesTool
   * @param {ListSourceCandidatesTool} listSourceCandidatesTool
   * @param {RecordActionTool} recordActionTool
   */
  constructor(
    findVacanciesTool: FindVacanciesTool,
    getVacancyTool: GetVacancyTool,
    listApplicationsTool: ListApplicationsTool,
    pipelineSummaryTool: PipelineSummaryTool,
    listSourcesTool: ListSourcesTool,
    listSourceCandidatesTool: ListSourceCandidatesTool,
    recordActionTool: RecordActionTool
  ) {
    this.tools = [
      findVacanciesTool,
      getVacancyTool,
      listApplicationsTool,
      pipelineSummaryTool,
      listSourcesTool,
      listSourceCandidatesTool,
      recordActionTool
    ];
  }

  /**
   * Register every tool on the server
   *
   * @param {McpServer} server
   *
   * @returns {void}
   */
  register(server: McpServer): void {
    for (const tool of this.tools) {
      tool.register(server, async (name, work) => this.run(name, work));
    }
  }

  /**
   * Run the work of a call and answer it
   *
   * @param {string} tool
   * @param {() => Promise<IToolAnswer>} work
   *
   * @returns {Promise<CallToolResult>}
   */
  private async run(tool: string, work: () => Promise<IToolAnswer>): Promise<CallToolResult> {
    try {
      const answer = await work();

      this.logger.debug({ message: 'MCP tool answered', tool });

      return toolResult(answer.data, answer.summary);
    } catch (error) {
      if (error instanceof JobsDBToolError) {
        this.logger.debug({ message: 'MCP tool refused', tool, code: error.code });

        return toolError(error.code, error.detail);
      }

      this.logger.error(`MCP tool ${tool} failed: ${this.describe(error)}`, error instanceof Error ? error.stack : undefined);

      return toolError(JobsDBErrorCodeEnum.TOOL_FAILED, 'The tool failed; the cause is in the server log. Try again later.');
    }
  }

  /**
   * The message of a failure with the message of its cause — a failed query names the query, its cause says why
   *
   * @param {unknown} error
   *
   * @returns {string}
   */
  private describe(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'unknown error';
    }

    return error.cause instanceof Error ? `${error.message} (cause: ${error.cause.message})` : error.message;
  }
}
