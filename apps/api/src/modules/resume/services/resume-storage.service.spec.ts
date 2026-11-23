import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createConfigMock } from '../../../../test/config-service.mock.js';
import { ResumeStorageService } from './resume-storage.service.js';

describe('ResumeStorageService (unit)', () => {
  let moduleFixture: TestingModule;
  let subjectUnderTest: ResumeStorageService;
  let storageDir: string;

  beforeEach(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'resume-storage-'));
    moduleFixture = await Test.createTestingModule({
      providers: [ResumeStorageService, { provide: ConfigService, useValue: createConfigMock({ STORAGE_DIR: storageDir }) }]
    }).compile();

    subjectUnderTest = moduleFixture.get(ResumeStorageService);
  });

  afterEach(async () => {
    await moduleFixture.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it('should be defined', () => {
    expect(subjectUnderTest).toBeDefined();
  });

  it('writes the file under the profile, named by its hash, and returns the relative path', async () => {
    const path = await subjectUnderTest.save(Buffer.from('resume'), 7, 'abc123', '.pdf');

    expect(path).toBe(join('profiles', '7', 'resumes', 'abc123.pdf'));
    await expect(readFile(join(storageDir, path), 'utf8')).resolves.toBe('resume');
  });

  it('overwrites the same file in the same place', async () => {
    await subjectUnderTest.save(Buffer.from('first'), 7, 'abc123', '.pdf');

    const path = await subjectUnderTest.save(Buffer.from('second'), 7, 'abc123', '.pdf');

    await expect(readFile(join(storageDir, path), 'utf8')).resolves.toBe('second');
  });
});
