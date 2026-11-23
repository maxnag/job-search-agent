import { describe, expect, it } from 'vitest';

import { isPublicAddress } from './public-address.helper.js';

describe('isPublicAddress', () => {
  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '100.127.255.254',
    '127.0.0.1',
    '127.255.255.255',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.8',
    '192.168.1.1',
    '198.18.0.1',
    '198.19.255.255',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255'
  ])('refuses the IPv4 address %s', address => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['::', '::1', '64:ff9b::7f00:1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1'])(
    'refuses the IPv6 address %s',
    address => {
      expect(isPublicAddress(address)).toBe(false);
    }
  );

  it.each(['8.8.8.8', '1.1.1.1', '100.63.255.255', '100.128.0.0', '172.15.255.255', '172.32.0.0', '198.17.255.255', '198.20.0.0'])(
    'allows the public IPv4 address %s, also next to a private network',
    address => {
      expect(isPublicAddress(address)).toBe(true);
    }
  );

  it.each(['2001:4860:4860::8888', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('allows the public IPv6 address %s', address => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each(['', 'localhost', 'example.com', '999.1.1.1'])('refuses %j, which is not an IP address', address => {
    expect(isPublicAddress(address)).toBe(false);
  });
});
