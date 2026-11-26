import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { routing } from './src/i18n/routing';

/**
 * Next.js settings of the web UI
 *
 * @type {NextConfig}
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  async redirects() {
    return [{ source: `/:locale(${routing.locales.join('|')})`, destination: '/:locale/vacancies', permanent: false }];
  },
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks', '@tabler/icons-react']
  }
};

export default createNextIntlPlugin()(nextConfig);
