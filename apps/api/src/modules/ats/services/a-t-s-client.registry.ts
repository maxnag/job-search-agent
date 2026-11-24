import type { ATSKindEnum } from '@job-agent/shared';

import type { IATSClient } from '../interfaces/a-t-s-client.interface.js';

/**
 * Picks the client of an applicant tracking system by its kind
 */
export class ATSClientRegistry {
  /**
   * Client of every registered system
   *
   * @var {ReadonlyMap<ATSKindEnum, IATSClient>}
   */
  private readonly clients: ReadonlyMap<ATSKindEnum, IATSClient>;

  /**
   * @param {readonly IATSClient[]} clients
   *
   * @throws {Error} `ATS_CLIENT_DUPLICATE` if two clients claim one system
   */
  constructor(clients: readonly IATSClient[]) {
    const byKind = new Map<ATSKindEnum, IATSClient>();

    for (const client of clients) {
      const owner = byKind.get(client.kind);

      if (owner) {
        throw new Error(`ATS_CLIENT_DUPLICATE: ${client.kind} is served by both ${owner.constructor.name} and ${client.constructor.name}`);
      }

      byKind.set(client.kind, client);
    }

    this.clients = byKind;
  }

  /**
   * Client of a system
   *
   * @param {ATSKindEnum} kind
   *
   * @throws {Error} `ATS_KIND_UNSUPPORTED` if no client serves the system
   *
   * @returns {IATSClient}
   */
  findOne(kind: ATSKindEnum): IATSClient {
    const client = this.clients.get(kind);

    if (!client) {
      throw new Error(`ATS_KIND_UNSUPPORTED: "${kind}" — supported: ${[...this.clients.keys()].join(', ')}`);
    }

    return client;
  }
}
