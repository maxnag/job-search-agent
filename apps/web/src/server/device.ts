import { headers } from 'next/headers';
import { userAgent } from 'next/server';
import 'server-only';

/**
 * True when the request comes from a phone, by its `User-Agent` — the layout of a phone stays the same when it is
 * turned, whatever the width. A tablet and a computer get the wide layout; an iPad in Safari calls itself a Mac and is
 * taken for one
 *
 * @returns {Promise<boolean>}
 */
export async function isPhone(): Promise<boolean> {
  const { device } = userAgent({ headers: await headers() });

  return device.type === 'mobile';
}
