import { BlockList, isIP } from 'node:net';

/**
 * IPv4 networks that are not the public internet: this host, private, carrier-grade NAT, loopback, link-local
 * (cloud metadata), IETF protocol assignments, benchmarking, multicast, reserved and broadcast
 *
 * @type {readonly string[]}
 */
const PRIVATE_IPV4_NETWORKS: readonly string[] = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '224.0.0.0/4',
  '240.0.0.0/4'
];

/**
 * IPv6 networks that are not the public internet: unspecified, loopback, NAT64, unique local, link-local, multicast.
 * IPv4-mapped addresses (`::ffff:127.0.0.1`) are checked against the IPv4 networks by `BlockList` itself
 *
 * @type {readonly string[]}
 */
const PRIVATE_IPV6_NETWORKS: readonly string[] = ['::/128', '::1/128', '64:ff9b::/96', 'fc00::/7', 'fe80::/10', 'ff00::/8'];

/**
 * Address and prefix length of a network written in CIDR notation
 *
 * @param {string} cidr
 *
 * @returns {[string, number]}
 */
function subnet(cidr: string): [string, number] {
  const [address = '', prefix = ''] = cidr.split('/');

  return [address, +prefix];
}

/**
 * Every network a crawler must never reach — the owner's machine, its LAN and the cloud metadata endpoint
 *
 * @type {BlockList}
 */
const PRIVATE_NETWORKS = new BlockList();

for (const network of PRIVATE_IPV4_NETWORKS) {
  PRIVATE_NETWORKS.addSubnet(...subnet(network), 'ipv4');
}

for (const network of PRIVATE_IPV6_NETWORKS) {
  PRIVATE_NETWORKS.addSubnet(...subnet(network), 'ipv6');
}

/**
 * Whether an IP address belongs to the public internet; anything that is not an IP address is not
 *
 * @param {string} address
 *
 * @returns {boolean}
 */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);

  if (family === 0) {
    return false;
  }

  return !PRIVATE_NETWORKS.check(address, family === 4 ? 'ipv4' : 'ipv6');
}
