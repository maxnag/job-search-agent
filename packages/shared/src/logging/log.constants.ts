/**
 * OpenTelemetry `service.namespace` of every service — the `service_namespace` label in Loki
 *
 * @type {string}
 */
export const LOG_SERVICE_NAMESPACE = 'job-agent';

/**
 * Field of a log line that holds the message — the one Nest's `Logger` fills
 *
 * @type {string}
 */
export const LOG_MESSAGE_KEY = 'message';

/**
 * Field of a log line that holds the request id; a field, never a Loki label
 *
 * @type {string}
 */
export const LOG_REQUEST_ID_KEY = 'request_id';

/**
 * Paths pino replaces with `[Redacted]` before a line leaves the process
 *
 * @type {readonly string[]}
 */
export const LOG_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.apiKey',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.password'
];
