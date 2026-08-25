import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client singleton.
 *
 * In development, Next.js / Nest's hot-reload can create multiple instances
 * of PrismaClient, exhausting DB connections. We guard against that by
 * caching the instance on globalThis.
 */
declare global {
  // eslint-disable-next-line no-var
  var __streamhubPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient = global.__streamhubPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__streamhubPrisma = prisma;
}

export * from '@prisma/client';
