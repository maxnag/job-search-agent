import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { routing } from './src/i18n/routing';

/**
 * Addresses of the machine itself, always allowed — with `WEB_HOST=0.0.0.0` Next no longer takes them for its own
 *
 * @type {readonly string[]}
 */
const LOOPBACK_ORIGINS: readonly string[] = ['127.0.0.1', 'localhost'];

/**
 * Addresses the dev server may be opened by: the loopback and the ones of `WEB_ALLOWED_DEV_ORIGINS` — the IP of the
 * machine when the web listens on the network. The config runs before the app and its env module, so it reads the
 * variable itself
 *
 * @type {string[]}
 */
const allowedDevOrigins = [
  ...new Set([
    ...LOOPBACK_ORIGINS,
    ...(process.env.WEB_ALLOWED_DEV_ORIGINS ?? '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  ])
];

/**
 * Next.js settings of the web UI
 *
 * @type {NextConfig}
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  allowedDevOrigins,
  async redirects() {
    return [{ source: `/:locale(${routing.locales.join('|')})`, destination: '/:locale/vacancies', permanent: false }];
  },
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks', '@tabler/icons-react']
  }
};

export default createNextIntlPlugin()(nextConfig);
