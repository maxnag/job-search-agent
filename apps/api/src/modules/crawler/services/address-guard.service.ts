import { lookup } from 'node:dns/promises';

import { Injectable, Logger } from '@nestjs/common';

import { CrawlErrorCodeEnum } from '../enums/crawl-error-code.enum.js';
import { CrawlError } from '../errors/crawl.error.js';
import { isPublicAddress } from '../helpers/public-address.helper.js';

/**
 * Brackets around an IPv6 address in a URL host
 *
 * @type {RegExp}
 */
const IPV6_BRACKETS = /^\[(.*)\]$/;

/**
 * Keeps the crawler on the public internet: a link on a page must not make it request the owner's machine, the LAN
 * or the cloud metadata endpoint (SSRF)
 */
@Injectable()
export class AddressGuardService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(AddressGuardService.name);

  /**
   * Refuse a URL whose host resolves to a private address — any of its addresses, as the request may use any
   *
   * @param {URL} url
   *
   * @throws {CrawlError} `PRIVATE_ADDRESS` if the host resolves to a private address
   * @throws {CrawlError} `FETCH_FAILED` if the host does not resolve
   *
   * @returns {Promise<void>}
   */
  async assertPublic(url: URL): Promise<void> {
    const address = await this.findPrivateAddress(url);

    if (address === undefined) {
      return;
    }

    this.logger.warn({ message: 'Private address refused', host: url.host });

    throw new CrawlError(CrawlErrorCodeEnum.PRIVATE_ADDRESS, `${url.host} resolves to ${address}`);
  }

  /**
   * Whether the host of a URL resolves to public addresses only; a host that does not resolve is not public
   *
   * @param {URL} url
   *
   * @returns {Promise<boolean>}
   */
  async isPublic(url: URL): Promise<boolean> {
    try {
      return (await this.findPrivateAddress(url)) === undefined;
    } catch {
      return false;
    }
  }

  /**
   * The first private address the host of a URL resolves to
   *
   * @param {URL} url
   *
   * @throws {CrawlError} `FETCH_FAILED` if the host does not resolve
   *
   * @returns {Promise<string | undefined>}
   */
  private async findPrivateAddress(url: URL): Promise<string | undefined> {
    const host = url.hostname.replace(IPV6_BRACKETS, '$1');
    let addresses: { address: string }[];

    try {
      addresses = await lookup(host, { all: true });
    } catch (error) {
      throw new CrawlError(CrawlErrorCodeEnum.FETCH_FAILED, `${url.host} does not resolve: ${(error as Error).message}`, { cause: error });
    }

    return addresses.find(({ address }) => !isPublicAddress(address))?.address;
  }
}
