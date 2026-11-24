import { resolve } from 'node:path';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

process.loadEnvFile(resolve(import.meta.dirname, '.env.example'));

export default defineConfig({
  plugins: [swc.vite({ swcrc: true })],
  test: {
    include: ['{apps,packages}/*/src/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['{apps,packages}/*/src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        '**/*.e2e-spec.ts',
        '**/*.interface.ts',
        '**/*.enum.ts',
        '**/index.ts',
        '**/main.ts',
        '**/cli/**',
        '**/schema/**'
      ],
      thresholds: { statements: 89, branches: 87, functions: 83, lines: 90 }
    },
    env: {
      NODE_ENV: 'test',
      ANTHROPIC_API_KEY: 'test-key-never-sent',
      OTEL_EXPORTER_OTLP_ENDPOINT: ''
    }
  }
});
