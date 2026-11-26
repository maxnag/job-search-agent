import { type DeepMocked, createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SourceFetchModeEnum, SourceStatusEnum } from '@job-agent/shared';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { type IRegisteredJobsDBTool, registerJobsDBTool } from '../../../../test/jobs-db-tool.harness.js';
import { READ_ONLY_TOOL } from '../helpers/jobs-db-tool.constants.js';
import type { IJobsDBSource } from '../interfaces/jobs-db-source.interface.js';
import { JobsDBRepository } from '../repositories/jobs-db.repository.js';
import { ListSourcesTool } from './list-sources.tool.js';

/**
 * A source with its state
 *
 * @param {number} sourceId
 * @param {Partial<IJobsDBSource>} [changes]
 *
 * @returns {IJobsDBSource}
 */
function source(sourceId: number, changes: Partial<IJobsDBSource> = {}): IJobsDBSource {
  return {
    sourceId,
    name: 'Northwind',
    url: `https://careers.example.com/${sourceId}`,
    fetchMode: SourceFetchModeEnum.HTML,
    isActive: true,
    status: SourceStatusEnum.OK,
    lastScanAt: null,
    lastError: null,
    openVacancies: 0,
    ...changes
  };
}

describe('ListSourcesTool (unit)', () => {
  let moduleFixture: TestingModule;
  let repository: DeepMocked<JobsDBRepository>;
  let tool: IRegisteredJobsDBTool;

  beforeEach(async () => {
    repository = createMock<JobsDBRepository>();
    repository.findSources.mockResolvedValue([]);
    moduleFixture = await Test.createTestingModule({
      providers: [
        ListSourcesTool,
        { provide: JobsDBRepository, useValue: repository },
        { provide: ConfigService, useValue: createConfigMock({ MCP_MAX_ROWS: 2 }) }
      ]
    }).compile();

    tool = registerJobsDBTool(moduleFixture.get(ListSourcesTool));
  });

  afterEach(async () => {
    await moduleFixture.close();
  });

  it('should be defined', () => {
    expect(moduleFixture.get(ListSourcesTool)).toBeDefined();
  });

  it('registers as a read-only tool', () => {
    expect(tool.name).toBe('list_sources');
    expect(tool.annotations).toEqual(READ_ONLY_TOOL);
  });

  it('passes the filter on and answers with the sources, the last scan as an ISO string', async () => {
    repository.findSources.mockResolvedValue([
      source(3, {
        status: SourceStatusEnum.BLOCKED,
        lastScanAt: new Date('2026-11-24T08:00:00.000Z'),
        lastError: 'HTTP 403',
        openVacancies: 5
      })
    ]);

    const answer = await tool.call({ status: SourceStatusEnum.BLOCKED, includeInactive: true });

    expect(repository.findSources).toHaveBeenCalledWith({ status: SourceStatusEnum.BLOCKED, includeInactive: true });
    expect(answer.summary).toBe('1 of 1 sources');
    expect(answer.data).toEqual({
      total: 1,
      sources: [
        {
          sourceId: 3,
          name: 'Northwind',
          url: 'https://careers.example.com/3',
          fetchMode: SourceFetchModeEnum.HTML,
          isActive: true,
          status: SourceStatusEnum.BLOCKED,
          lastScanAt: '2026-11-24T08:00:00.000Z',
          lastError: 'HTTP 403',
          openVacancies: 5
        }
      ]
    });
  });

  it('asks for the switched-on sources of any status by default and caps the rows', async () => {
    repository.findSources.mockResolvedValue([source(1), source(2), source(3)]);

    const answer = await tool.call();

    expect(repository.findSources).toHaveBeenCalledWith({ status: undefined, includeInactive: undefined });
    expect((answer.data.sources as IJobsDBSource[]).map(row => row.sourceId)).toEqual([1, 2]);
    expect(answer.summary).toBe('2 of 3 sources');
  });

  it('refuses a status sources do not have', () => {
    expect(tool.accepts({ status: 'broken' })).toBe(false);
  });
});
