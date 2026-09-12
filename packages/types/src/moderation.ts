/**
 * Phase 10 — Moderation & Administration shared shapes (API responses +
 * web client). Keep in sync with the Prisma `Report` model, the
 * `ReportStatus`/`ReportReason`/`ReportTargetType` enums, and the
 * AuditLog service.
 */

export type ReportTargetType = 'USER' | 'CHANNEL' | 'STREAM' | 'VOD';

export type ReportReason = 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE_CONTENT' | 'COPYRIGHT' | 'OTHER';

export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';

/** Reporter-facing shape — only what the submitter needs to see. */
export interface ReportCreated {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  status: ReportStatus;
  createdAt: string;
}

export interface ReportPublic extends ReportCreated {
  description?: string | null;
  reviewedAt?: string | null;
  resolutionNote?: string | null;
  /** Admin review queue projection — reporter username for triage context. */
  reporter?: { id: string; username: string } | null;
}

/** Body of `POST /api/v1/reports` (any authenticated user). */
export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

/** Body of `PATCH /api/v1/admin/reports/:id` (MODERATOR/ADMIN only). */
export interface UpdateReportInput {
  status?: ReportStatus;
  resolutionNote?: string | null;
}

/** One immutable audit-trail entry. */
export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}
