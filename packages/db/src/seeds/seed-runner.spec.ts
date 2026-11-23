import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database, DatabaseExecutor } from '../interfaces/database-connection.interface.js';
import { runSeeds } from './seed-runner.js';
import type { ISeedSet } from './seed-set.interface.js';

const tx = {} as DatabaseExecutor;
const db = { transaction: vi.fn(async (work: (executor: DatabaseExecutor) => Promise<void>) => work(tx)) } as unknown as Database;

describe('runSeeds', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs every set in order inside one transaction', async () => {
    const order: string[] = [];
    const seeds: ISeedSet[] = [
      { name: 'first', run: executor => Promise.resolve(order.push(executor === tx ? 'first in tx' : 'first')) },
      { name: 'second', run: executor => Promise.resolve(order.push(executor === tx ? 'second in tx' : 'second')) }
    ];

    await runSeeds(db, seeds);

    expect(order).toEqual(['first in tx', 'second in tx']);
    expect(console.info).toHaveBeenCalledWith('Seeds done: 2 sets');
  });

  it('passes on the failure of a set, so the transaction rolls back', async () => {
    const seeds: ISeedSet[] = [{ name: 'broken', run: async () => Promise.reject(new Error('duplicate key')) }];

    await expect(runSeeds(db, seeds)).rejects.toThrow('duplicate key');
  });
});
