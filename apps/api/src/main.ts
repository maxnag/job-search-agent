import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import 'reflect-metadata';

import { AppModule } from './app.module.js';
import type { IEnv } from './config/env.schema.js';

const logger = new Logger('Bootstrap');
const app = await NestFactory.create(AppModule, { bufferLogs: true });

app.useLogger(app.get(PinoLogger));

const configService = app.get<ConfigService<IEnv, true>>(ConfigService);
const host = configService.get('APP_HOST', { infer: true });
const port = configService.get('APP_PORT', { infer: true });

app.enableShutdownHooks();
await app.listen(port, host);

logger.log({
  message: 'API started',
  host,
  port,
  version: configService.get('APP_VERSION', { infer: true }),
  llmProvider: configService.get('LLM_PROVIDER', { infer: true }),
  bullBoard: configService.get('BULL_BOARD_PATH', { infer: true })
});
