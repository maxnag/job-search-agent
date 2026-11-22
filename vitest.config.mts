import { resolve } from 'node:path';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

process.loadEnvFile(resolve(import.meta.dirname, '.env.example'));

export default defineConfig({
  plugins: [swc.vite({ swcrc: true })],
  test: {
    include: ['{apps,packages}/*/src/**/*.spec.ts'],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      ANTHROPIC_API_KEY: 'test-key-never-sent',
      OTEL_EXPORTER_OTLP_ENDPOINT: ''
    }
  }
});
