import { createMock } from '@golevelup/ts-vitest';
import { describe, expect, it } from 'vitest';

import { ATSKindEnum } from '@job-agent/shared';

import type { IATSClient } from '../interfaces/a-t-s-client.interface.js';
import { ATSClientRegistry } from './a-t-s-client.registry.js';

/**
 * A client of one kind
 *
 * @param {ATSKindEnum} kind
 *
 * @returns {IATSClient}
 */
function client(kind: ATSKindEnum): IATSClient {
  return createMock<IATSClient>({ kind });
}

describe('ATSClientRegistry (unit)', () => {
  it('finds the client of a kind', () => {
    const greenhouse = client(ATSKindEnum.GREENHOUSE);
    const lever = client(ATSKindEnum.LEVER);

    expect(new ATSClientRegistry([greenhouse, lever]).findOne(ATSKindEnum.LEVER)).toBe(lever);
  });

  it('throws ATS_KIND_UNSUPPORTED for a kind no client serves, naming the supported ones', () => {
    const registry = new ATSClientRegistry([client(ATSKindEnum.GREENHOUSE), client(ATSKindEnum.LEVER)]);

    expect(() => registry.findOne(ATSKindEnum.COMEET)).toThrow('ATS_KIND_UNSUPPORTED: "comeet" — supported: greenhouse, lever');
  });

  it('throws ATS_CLIENT_DUPLICATE when two clients serve one kind', () => {
    expect(() => new ATSClientRegistry([client(ATSKindEnum.COMEET), client(ATSKindEnum.COMEET)])).toThrow('ATS_CLIENT_DUPLICATE: comeet');
  });
});
