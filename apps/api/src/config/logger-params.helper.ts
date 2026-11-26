import { randomUUID } from 'node:crypto';

import { HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { Params } from 'nestjs-pino';
import type { LevelWithSilent, TransportTargetOptions } from 'pino';

import { LOG_MESSAGE_KEY, LOG_REDACT_PATHS, LOG_REQUEST_ID_KEY, LOG_SERVICE_NAMESPACE, LogLevelEnum } from '@job-agent/shared';

import type { IEnv } from './env.schema.js';

/**
 * OpenTelemetry `service.name` of the API — the `service_name` label of its lines in Loki
 *
 * @type {string}
 */
export const LOG_SERVICE_NAME = 'api';

/**
 * Routes whose requests are not logged: polled by Docker and monitors, they would bury the real events
 *
 * @type {ReadonlySet<string>}
 */
const UNLOGGED_PATHS: ReadonlySet<string> = new Set(['/health']);

/**
 * File descriptor of stdout — where the API writes its lines
 *
 * @type {number}
 */
const STDOUT_FD = 1;

/**
 * File descriptor of stderr — where an MCP server writes its lines: its stdout carries the protocol only
 *
 * @type {number}
 */
const STDERR_FD = 2;

/**
 * Level of the line that closes a request, by who has to act: unavailability and rate limits are handled (`warn`),
 * any other 5xx is a failure (`error`), everything else is an ordinary event (`info`)
 *
 * @param {Request} _request
 * @param {Response} response
 * @param {Error} error
 *
 * @returns {LevelWithSilent}
 */
export function requestLogLevel(_request: Request, response: Response, error?: Error): LevelWithSilent {
  if (response.statusCode === +HttpStatus.TOO_MANY_REQUESTS || response.statusCode === +HttpStatus.SERVICE_UNAVAILABLE) {
    return LogLevelEnum.WARN;
  }

  if (error !== undefined || response.statusCode >= +HttpStatus.INTERNAL_SERVER_ERROR) {
    return LogLevelEnum.ERROR;
  }

  return LogLevelEnum.INFO;
}

/**
 * Where the lines go: one readable line each in development, JSON otherwise — both to the given descriptor; with an
 * OTLP endpoint also to Loki. The exporter reads the endpoint from `OTEL_EXPORTER_OTLP_ENDPOINT` itself
 *
 * @param {ConfigService<IEnv, true>} configService
 * @param {number} destination
 *
 * @returns {TransportTargetOptions[]}
 */
function logTargets(configService: ConfigService<IEnv, true>, destination: number): TransportTargetOptions[] {
  const level = configService.get('LOG_LEVEL', { infer: true });
  const nodeEnv = configService.get('NODE_ENV', { infer: true });
  const targets: TransportTargetOptions[] = [
    nodeEnv === 'development'
      ? { target: 'pino-pretty', level, options: { messageKey: LOG_MESSAGE_KEY, singleLine: true, ignore: 'pid,hostname', destination } }
      : { target: 'pino/file', level, options: { destination } }
  ];

  if (configService.get('OTEL_EXPORTER_OTLP_ENDPOINT', { infer: true }) !== undefined) {
    targets.push({
      target: 'pino-opentelemetry-transport',
      level,
      options: {
        messageKey: LOG_MESSAGE_KEY,
        resourceAttributes: {
          'service.name': LOG_SERVICE_NAME,
          'service.namespace': LOG_SERVICE_NAMESPACE,
          'service.version': configService.get('APP_VERSION', { infer: true }),
          'deployment.environment.name': nodeEnv
        }
      }
    });
  }

  return targets;
}

/**
 * Settings of the logger, its lines written to the given descriptor
 *
 * @param {ConfigService<IEnv, true>} configService
 * @param {number} destination
 *
 * @returns {Params<Request, Response>}
 */
function paramsFor(configService: ConfigService<IEnv, true>, destination: number): Params<Request, Response> {
  return {
    pinoHttp: {
      level: configService.get('LOG_LEVEL', { infer: true }),
      messageKey: LOG_MESSAGE_KEY,
      redact: [...LOG_REDACT_PATHS],
      transport: { targets: logTargets(configService, destination) },
      genReqId: () => randomUUID(),
      quietReqLogger: true,
      customAttributeKeys: { reqId: LOG_REQUEST_ID_KEY, responseTime: 'duration_ms' },
      customLogLevel: requestLogLevel,
      autoLogging: { ignore: request => UNLOGGED_PATHS.has(request.url ?? '') },
      serializers: {
        req: (request: Pick<Request, 'method' | 'url'>) => ({ method: request.method, url: request.url }),
        res: (response: Pick<Response, 'statusCode'>) => ({ status_code: response.statusCode })
      }
    }
  };
}

/**
 * Settings of the API logger: JSON lines with the request id on every line of a request, request lines without
 * headers or bodies, credentials redacted
 *
 * @param {ConfigService<IEnv, true>} configService
 *
 * @returns {Params<Request, Response>}
 */
export function loggerParams(configService: ConfigService<IEnv, true>): Params<Request, Response> {
  return paramsFor(configService, STDOUT_FD);
}

/**
 * Settings of the logger of an MCP server: the same lines, written to stderr — one line on stdout breaks the session
 *
 * @param {ConfigService<IEnv, true>} configService
 *
 * @returns {Params<Request, Response>}
 */
export function mcpLoggerParams(configService: ConfigService<IEnv, true>): Params<Request, Response> {
  return paramsFor(configService, STDERR_FD);
}
