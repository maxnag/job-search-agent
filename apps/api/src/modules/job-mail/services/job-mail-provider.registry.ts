import type { JobMailProviderEnum } from '@job-agent/shared';

import type { IJobMailProvider } from '../interfaces/job-mail-provider.interface.js';

/**
 * Picks the adapter of the mail provider set by `JOB_MAIL_PROVIDER`
 */
export class JobMailProviderRegistry {
  /**
   * Adapter of every registered provider
   *
   * @var {ReadonlyMap<JobMailProviderEnum, IJobMailProvider>}
   */
  private readonly providers: ReadonlyMap<JobMailProviderEnum, IJobMailProvider>;

  /**
   * @param {readonly IJobMailProvider[]} providers
   *
   * @throws {Error} `JOB_MAIL_PROVIDER_DUPLICATE` if two adapters claim one provider
   */
  constructor(providers: readonly IJobMailProvider[]) {
    const byProvider = new Map<JobMailProviderEnum, IJobMailProvider>();

    for (const provider of providers) {
      const owner = byProvider.get(provider.provider);

      if (owner) {
        throw new Error(
          `JOB_MAIL_PROVIDER_DUPLICATE: ${provider.provider} is served by both ${owner.constructor.name} and ${provider.constructor.name}`
        );
      }

      byProvider.set(provider.provider, provider);
    }

    this.providers = byProvider;
  }

  /**
   * Adapter of a provider
   *
   * @param {JobMailProviderEnum} provider
   *
   * @throws {Error} `JOB_MAIL_PROVIDER_UNSUPPORTED` if no adapter serves the provider
   *
   * @returns {IJobMailProvider}
   */
  findOne(provider: JobMailProviderEnum): IJobMailProvider {
    const adapter = this.providers.get(provider);

    if (!adapter) {
      throw new Error(`JOB_MAIL_PROVIDER_UNSUPPORTED: "${provider}" — supported: ${[...this.providers.keys()].join(', ')}`);
    }

    return adapter;
  }
}
