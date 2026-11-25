import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import 'reflect-metadata';

import { MCPServerNameEnum, startStdioServer } from '@job-agent/mcp';

import { JobsDBToolsService } from '../modules/jobs-db/services/jobs-db-tools.service.js';

let app: INestApplicationContext | undefined;

try {
  const { MCPModule } = await import('./m-c-p.module.js');

  app = await NestFactory.createApplicationContext(MCPModule, { logger: ['error', 'fatal'], abortOnError: false });
  app.useLogger(app.get(PinoLogger));

  const context = app;
  const tools = context.get(JobsDBToolsService);

  await startStdioServer(
    MCPServerNameEnum.JOBS_DB,
    server => tools.register(server),
    async () => context.close()
  );
} catch (error) {
  process.stderr.write(
    `MCP server ${MCPServerNameEnum.JOBS_DB} failed to start: ${error instanceof Error ? error.message : 'unknown error'}\n`
  );
  process.exitCode = 1;
  await app?.close();
}
