import { Global, Injectable, Logger, Module } from '@nestjs/common';
import type { AuditLogEntry } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';

/**
 * Phase 10 — append-only audit trail for administrative actions.
 *
 * Every mutating admin/moderator operation calls `record()` with the actor,
 * a machine-readable action name, the target entity and free-form metadata
 * (the "before" snapshot, the reason, etc.).
 *
 * Invariants:
 *  - Rows are only ever INSERTed. No update/delete method exists here, and
 *    the REST surface is read-only + ADMIN-only, so normal users can never
 *    modify the trail.
 *  - `actorId` has no FK: the trail must survive deletion of the actor.
 *  - Recording is best-effort — a failed audit write logs and swallows the
 *    error rather than failing the administrative operation it describes.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plain JSON-serializable object; the client's Json input type is structurally this.
          metadata: (entry.metadata ?? undefined) as any,
        },
      });
    } catch (err) {
      // Never let audit-bookkeeping break the operation it documents.
      this.logger.error(
        `Failed to write audit log (action=${entry.action} target=${entry.targetType}:${entry.targetId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * `GET /admin/audit-logs` — newest first, filterable by actor/target/
   * action. Always paginated (bounded), always ADMIN-only (enforced by the
   * controller's @Roles('ADMIN')).
   */
  async list(query: {
    page?: number;
    limit?: number;
    actorId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
  }): Promise<{ items: AuditLogEntry[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = query.action;
    if (query.targetType) where.targetType = query.targetType;
    if (query.targetId) where.targetId = query.targetId;

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map(
        (r): AuditLogEntry => ({
          id: r.id,
          actorId: r.actorId,
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          metadata: (r.metadata as Record<string, unknown> | null) ?? null,
          createdAt: r.createdAt.toISOString(),
        }),
      ),
      total,
      page,
      limit,
    };
  }
}

/** Global so every module that performs admin actions can inject it. */
@Global()
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
