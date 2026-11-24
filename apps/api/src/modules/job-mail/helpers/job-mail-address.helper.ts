import type { JobMailProviderEnum } from '@job-agent/shared';

/**
 * Key of an e-mail across providers: its `Message-ID` header, which Gmail and Outlook keep the same, so a mailbox read
 * through another provider is not read twice; `<provider>:<provider id>` for an e-mail without the header
 *
 * @param {string | undefined} messageId
 * @param {JobMailProviderEnum} provider
 * @param {string} providerId
 *
 * @returns {string}
 */
export function jobMailMessageKey(messageId: string | undefined, provider: JobMailProviderEnum, providerId: string): string {
  const key = messageId?.trim();

  return key ? key : `${provider}:${providerId}`;
}

/**
 * Domain of an address, lower case, without the part before `@`; empty for an address without one
 *
 * @param {string} address
 *
 * @returns {string}
 */
export function senderDomain(address: string): string {
  const at = address.lastIndexOf('@');

  return at < 0
    ? ''
    : address
        .slice(at + 1)
        .trim()
        .toLowerCase();
}
