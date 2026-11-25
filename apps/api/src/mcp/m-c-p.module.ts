import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { createConfigModule } from '../config/config-module.factory.js';
import { mcpLoggerParams } from '../config/logger-params.helper.js';
import { DatabaseModule } from '../modules/database/database.module.js';
import { JobsDBModule } from '../modules/jobs-db/jobs-db.module.js';

/**
 * Root module of the MCP servers: configuration, a logger that writes to stderr only, the database and the tools — no
 * HTTP, no queues
 */
@Module({
  imports: [
    createConfigModule(),
    LoggerModule.forRootAsync({ inject: [ConfigService], useFactory: mcpLoggerParams }),
    DatabaseModule,
    JobsDBModule
  ]
})
export class MCPModule {}
