import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { McpServer } from '@job-agent/mcp';

import { JobsDBErrorCodeEnum } from '../enums/jobs-db-error-code.enum.js';
import { JobsDBToolError } from '../errors/jobs-db-tool.error.js';
import type { IJobsDBTool, IToolRunner } from '../interfaces/jobs-db-tool.interface.js';
import { FindVacanciesTool } from '../tools/find-vacancies.tool.js';
import { GetVacancyTool } from '../tools/get-vacancy.tool.js';
import { ListApplicationsTool } from '../tools/list-applications.tool.js';
import { ListSourceCandidatesTool } from '../tools/list-source-candidates.tool.js';
import { ListSourcesTool } from '../tools/list-sources.tool.js';
import { PipelineSummaryTool } from '../tools/pipeline-summary.tool.js';
import { RecordActionTool } from '../tools/record-action.tool.js';
import { JobsDBToolsService } from './jobs-db-tools.service.js';

const TOOLS = [
  FindVacanciesTool,
  GetVacancyTool,
  ListApplicationsTool,
  PipelineSummaryTool,
  ListSourcesTool,
  ListSourceCandidatesTool,
  RecordActionTool
] as const;

describe('JobsDBToolsService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: JobsDBToolsService;
  let tools: DeepMocked<IJobsDBTool>[];
  let server: McpServer;

  /**
   * The runner the service gave the tools
   *
   * @returns {IToolRunner}
   */
  function runner(): IToolRunner {
    subjectUnderTest.register(server);

    const [call] = tools[0]?.register.mock.calls ?? [];

    if (call === undefined) {
      throw new Error('The service registered no tool');
    }

    return call[1];
  }

  beforeEach(async () => {
    tools = TOOLS.map(() => createMock<IJobsDBTool>());
    server = createMock<McpServer>();
    moduleFixture = await Test.createTestingModule({
      providers: [JobsDBToolsService, ...TOOLS.map((tool, index) => ({ provide: tool, useValue: tools[index] }))]
    }).compile();

    subjectUnderTest = moduleFixture.get(JobsDBToolsService);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('registers every tool on the server, in order', () => {
    subjectUnderTest.register(server);

    for (const tool of tools) {
      expect(tool.register).toHaveBeenCalledWith(server, expect.any(Function));
    }

    const order = tools.map(tool => tool.register.mock.invocationCallOrder[0] ?? 0);

    expect(order).toEqual([...order].sort((left, right) => left - right));
  });

  it('answers with the data and its summary', async () => {
    const result = await runner()('find_vacancies', () => Promise.resolve({ data: { total: 0 }, summary: '0 of 0 vacancies' }));

    expect(result).toEqual({
      content: [{ type: 'text', text: '0 of 0 vacancies\n\n{"total":0}' }],
      structuredContent: { total: 0 }
    });
  });

  it('answers a refusal with its code and detail, without an error line', async () => {
    const errorSpy = vi.spyOn(Logger.prototype, 'error');

    const result = await runner()('get_vacancy', () =>
      Promise.reject(new JobsDBToolError(JobsDBErrorCodeEnum.VACANCY_NOT_FOUND, 'There is no vacancy 999'))
    );

    expect(result).toEqual({ content: [{ type: 'text', text: 'VACANCY_NOT_FOUND: There is no vacancy 999' }], isError: true });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs a failure with its cause and answers only with the code', async () => {
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const failure = new Error('Failed query: select …', { cause: new Error('connect ECONNREFUSED') });

    const result = await runner()('pipeline_summary', () => Promise.reject(failure));

    expect(result).toEqual({
      content: [{ type: 'text', text: 'TOOL_FAILED: The tool failed; the cause is in the server log. Try again later.' }],
      isError: true
    });
    expect(JSON.stringify(result)).not.toContain('ECONNREFUSED');
    expect(errorSpy).toHaveBeenCalledWith(
      'MCP tool pipeline_summary failed: Failed query: select … (cause: connect ECONNREFUSED)',
      failure.stack
    );
  });

  it('logs a failure without a cause by its message', async () => {
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await runner()('list_sources', () => Promise.reject(new Error('pool is closed')));

    expect(errorSpy).toHaveBeenCalledWith('MCP tool list_sources failed: pool is closed', expect.any(String));
  });

  it('logs a cause that is not an error by the message alone, and a thrown value that is not an error without a stack', async () => {
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const result = await runner()('list_sources', () => Promise.reject(new Error('x', { cause: 'not an error' })));
    const notAnError: Error = { name: 'Odd', message: 'odd' };
    const odd = await runner()('list_sources', () => Promise.reject(notAnError));

    expect(result.isError).toBe(true);
    expect(odd.isError).toBe(true);
    expect(errorSpy).toHaveBeenNthCalledWith(1, 'MCP tool list_sources failed: x', expect.any(String));
    expect(errorSpy).toHaveBeenNthCalledWith(2, 'MCP tool list_sources failed: unknown error', undefined);
  });
});
