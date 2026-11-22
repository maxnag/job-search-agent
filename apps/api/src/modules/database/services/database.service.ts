import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';

import { type Database, type IDatabaseConnection, createDatabaseConnection } from '@job-agent/db';

import type { IEnv } from '../../../config/env.schema.js';

/**
 * Owner of the Postgres pool: one pool per application, closed on shutdown
 */
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  /**
   * Drizzle client the repositories use
   *
   * @var {Database}
   */
  readonly db: Database;

  /**
   * Connection behind the Drizzle client
   *
   * @var {IDatabaseConnection}
   */
  private readonly connection: IDatabaseConnection;

  /**
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(private readonly configService: ConfigService<IEnv, true>) {
    this.connection = createDatabaseConnection({
      url: this.configService.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMs: this.configService.get('DATABASE_CONNECTION_TIMEOUT_MS', { infer: true })
    });
    this.db = this.connection.db;
  }

  /**
   * Run `select 1` to prove the database answers
   *
   * @returns {Promise<void>}
   */
  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }

  /**
   * Close every connection of the pool
   *
   * @returns {Promise<void>}
   */
  async onApplicationShutdown(): Promise<void> {
    await this.connection.pool.end();
  }
}
