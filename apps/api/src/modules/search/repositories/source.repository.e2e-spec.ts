import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { truncateTables } from '@job-agent/db';
import { SourceFetchModeEnum, SourceStatusEnum } from '@job-agent/shared';

import { testDatabaseProvider } from '../../../../test/test-database.provider.js';
import { PIPELINE_TABLES, insertSource } from '../../../../test/vacancy-fixtures.js';
import { DatabaseService } from '../../database/services/database.service.js';
import { SourceRepository } from './source.repository.js';

describe('SourceRepository (e2e)', () => {
  let moduleFixture: TestingModule;
  let repository: SourceRepository;
  let database: DatabaseService;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ providers: [SourceRepository, testDatabaseProvider()] }).compile();
    repository = moduleFixture.get(SourceRepository);
    database = moduleFixture.get(DatabaseService);
  });

  beforeEach(async () => {
    await truncateTables(database.db, PIPELINE_TABLES);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('finds a source by id, and nothing for an unknown one', async () => {
    const source = await insertSource(database, { source_name: 'Northwind' });

    await expect(repository.findOne(source.source_id)).resolves.toMatchObject({ source_name: 'Northwind' });
    await expect(repository.findOne(999)).resolves.toBeUndefined();
  });

  it('schedules only switched-on sources in order, switched-off and stopped ones aside', async () => {
    const first = await insertSource(database);
    const second = await insertSource(database);

    await insertSource(database, { source_is_active: false });
    await insertSource(database, { source_status: SourceStatusEnum.BLOCKED });
    await insertSource(database, { source_status: SourceStatusEnum.BLOCKED_BY_ROBOTS });
    await insertSource(database, { source_url: 'mailto:@jobs.example.com', source_fetch_mode: SourceFetchModeEnum.JOB_MAIL });

    expect((await repository.findScannable()).map(source => source.source_id)).toEqual([first.source_id, second.source_id]);
  });

  it('lists the switched-on sources, stopped ones included, for a forced scan', async () => {
    const ok = await insertSource(database);
    const blocked = await insertSource(database, { source_status: SourceStatusEnum.BLOCKED });

    await insertSource(database, { source_is_active: false });
    await insertSource(database, { source_url: 'mailto:@jobs.example.com', source_fetch_mode: SourceFetchModeEnum.JOB_MAIL });

    expect((await repository.findActive()).map(source => source.source_id)).toEqual([ok.source_id, blocked.source_id]);
  });

  it('lists every source', async () => {
    await insertSource(database);
    await insertSource(database, { source_is_active: false });

    await expect(repository.findAll()).resolves.toHaveLength(2);
  });

  it('marks a scan: status back to ok, the time set, the last error cleared', async () => {
    const source = await insertSource(database, { source_status: SourceStatusEnum.BLOCKED, source_last_error: 'HTTP 403' });

    await repository.markScanned(source.source_id);

    const row = await repository.findOne(source.source_id);

    expect(row).toMatchObject({ source_status: SourceStatusEnum.OK, source_last_error: null });
    expect(row?.source_last_scan_at).toBeInstanceOf(Date);
  });

  it('records a failure, keeping the status unless one is given', async () => {
    const source = await insertSource(database);

    await repository.markFailed(source.source_id, 'FETCH_FAILED: timeout');
    await expect(repository.findOne(source.source_id)).resolves.toMatchObject({
      source_status: SourceStatusEnum.OK,
      source_last_error: 'FETCH_FAILED: timeout'
    });

    await repository.markFailed(source.source_id, 'SOURCE_BLOCKED: HTTP 403', SourceStatusEnum.BLOCKED);
    await expect(repository.findOne(source.source_id)).resolves.toMatchObject({ source_status: SourceStatusEnum.BLOCKED });
  });
});
