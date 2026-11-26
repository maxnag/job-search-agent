import type { Request, Response } from 'express';
import type { TransportMultiOptions } from 'pino';
import { describe, expect, it } from 'vitest';

import { createConfigMock } from '../../test/config-service.mock.js';
import type { IEnv } from './env.schema.js';
import { loggerParams, mcpLoggerParams, requestLogLevel } from './logger-params.helper.js';

const response = (statusCode: number): Response => ({ statusCode }) as Response;

const destinations = (params: typeof loggerParams, env: Partial<Record<keyof IEnv, unknown>>): unknown[] => {
  const pinoHttp = params(createConfigMock({ LOG_LEVEL: 'info', APP_VERSION: 'dev', ...env })).pinoHttp as {
    transport: TransportMultiOptions;
  };

  return pinoHttp.transport.targets.map(target => (target.options as { destination?: number } | undefined)?.destination);
};

const targets = (env: Partial<Record<keyof IEnv, unknown>>): string[] => {
  const pinoHttp = loggerParams(createConfigMock({ LOG_LEVEL: 'info', APP_VERSION: 'dev', ...env })).pinoHttp as {
    transport: TransportMultiOptions;
  };

  return pinoHttp.transport.targets.map(target => (target as { target: string }).target);
};

describe('requestLogLevel', () => {
  it.each([
    [200, 'info'],
    [404, 'info'],
    [429, 'warn'],
    [503, 'warn'],
    [500, 'error']
  ])('logs a %s response as %s', (statusCode, level) => {
    expect(requestLogLevel({} as Request, response(statusCode))).toBe(level);
  });

  it('logs a request that threw as an error, whatever the status', () => {
    expect(requestLogLevel({} as Request, response(200), new Error('boom'))).toBe('error');
  });
});

describe('loggerParams', () => {
  it('prints readable lines in development', () => {
    expect(targets({ NODE_ENV: 'development' })).toEqual(['pino-pretty']);
  });

  it('prints JSON lines elsewhere', () => {
    expect(targets({ NODE_ENV: 'production' })).toEqual(['pino/file']);
  });

  it('also ships to Loki when an OTLP endpoint is set', () => {
    expect(targets({ NODE_ENV: 'production', OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:3100/otlp' })).toEqual([
      'pino/file',
      'pino-opentelemetry-transport'
    ]);
  });

  it('does not log requests of /health', () => {
    const pinoHttp = loggerParams(createConfigMock({ NODE_ENV: 'production', LOG_LEVEL: 'info' })).pinoHttp as {
      autoLogging: { ignore: (request: Request) => boolean };
    };

    expect(pinoHttp.autoLogging.ignore({ url: '/health' } as Request)).toBe(true);
    expect(pinoHttp.autoLogging.ignore({ url: '/queues' } as Request)).toBe(false);
  });
});

describe('mcpLoggerParams', () => {
  it.each(['development', 'production'])('writes every line of an MCP server to stderr in %s, the API to stdout', nodeEnv => {
    expect(destinations(mcpLoggerParams, { NODE_ENV: nodeEnv })).toEqual([2]);
    expect(destinations(loggerParams, { NODE_ENV: nodeEnv })).toEqual([1]);
  });

  it('ships to Loki the same way, nothing on stdout', () => {
    expect(destinations(mcpLoggerParams, { NODE_ENV: 'production', OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:3100/otlp' })).toEqual([
      2,
      undefined
    ]);
  });
});
