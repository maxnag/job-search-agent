import { resolve } from 'node:path';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

process.loadEnvFile(resolve(import.meta.dirname, '.env.example'));

const env = {
  NODE_ENV: 'test',
  ANTHROPIC_API_KEY: 'test-key-never-sent',
  OTEL_EXPORTER_OTLP_ENDPOINT: ''
};

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [swc.vite({ swcrc: true })],
        test: {
          name: 'api',
          include: ['{apps,packages}/*/src/**/*.spec.ts'],
          exclude: ['apps/web/**', '**/node_modules/**'],
          environment: 'node',
          env
        }
      },
      {
        resolve: { alias: { '@': resolve(import.meta.dirname, 'apps/web/src') } },
        test: {
          name: 'web',
          root: resolve(import.meta.dirname, 'apps/web'),
          include: ['src/**/*.spec.{ts,tsx}', '*.spec.ts'],
          environment: 'jsdom',
          setupFiles: ['test/setup.ts'],
          server: { deps: { inline: ['next-intl'] } },
          env
        }
      }
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['{apps,packages}/*/src/**/*.{ts,tsx}', 'apps/web/next.config.ts'],
      exclude: [
        '**/*.spec.{ts,tsx}',
        '**/*.e2e-spec.ts',
        '**/*.interface.ts',
        '**/*.enum.ts',
        '**/index.ts',
        '**/main.ts',
        '**/cli/**',
        '**/mcp/*.server.ts',
        '**/repositories/**',
        '**/schema/**',
        'apps/web/src/proxy.ts',
        'apps/web/src/global.ts',
        'apps/web/src/theme.ts',
        'apps/web/src/i18n/routing.ts',
        'apps/web/src/i18n/navigation.ts',
        'apps/web/src/app/**/loading.tsx'
      ],
      thresholds: { statements: 95, branches: 92, functions: 95, lines: 95 }
    }
  }
});
