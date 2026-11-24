import { createMock } from '@golevelup/ts-vitest';
import { describe, expect, it } from 'vitest';

import { JobMailProviderEnum } from '@job-agent/shared';

import type { IJobMailProvider } from '../interfaces/job-mail-provider.interface.js';
import { JobMailProviderRegistry } from './job-mail-provider.registry.js';

describe('JobMailProviderRegistry (unit)', () => {
  it('finds the adapter of a provider', () => {
    const imap = createMock<IJobMailProvider>({ provider: JobMailProviderEnum.IMAP });

    expect(new JobMailProviderRegistry([imap]).findOne(JobMailProviderEnum.IMAP)).toBe(imap);
  });

  it('refuses a provider without an adapter', () => {
    expect(() => new JobMailProviderRegistry([]).findOne(JobMailProviderEnum.IMAP)).toThrow('JOB_MAIL_PROVIDER_UNSUPPORTED: "imap"');
  });

  it('refuses two adapters of one provider', () => {
    const adapters = [
      createMock<IJobMailProvider>({ provider: JobMailProviderEnum.IMAP }),
      createMock<IJobMailProvider>({ provider: JobMailProviderEnum.IMAP })
    ];

    expect(() => new JobMailProviderRegistry(adapters)).toThrow('JOB_MAIL_PROVIDER_DUPLICATE: imap');
  });
});
