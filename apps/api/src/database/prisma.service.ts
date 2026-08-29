import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@streamhub/database';

/**
 * Database access for the API. Wraps the shared Prisma client so every module
 * can inject `PrismaService` without touching the connection details.
 *
 * Phase 1 only establishes the connection lifecycle; repositories/queries are
 * added per domain module in later phases.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
