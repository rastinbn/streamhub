import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateReportInput, ReportPublic, UpdateReportInput } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../admin/audit-log.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';

/**
 * Phase 10 — report lifecycle: submit → (MODERATOR/ADMIN) triage.
 *
 * Reports target loose (targetType, targetId) pairs with no FK, so the
 * audit trail of "this was reported" survives deletion of the reported
 * entity. Validation that the target exists happens at submission time
 * where cheap — but a target deleted afterwards never invalidates the row.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto): Promise<ReportPublic> {
    if (dto.targetType === 'USER') {
      const target = await this.prisma.user.findUnique({ where: { id: dto.targetId } });
      if (!target) throw new BadRequestException('Reported user does not exist');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        description: dto.description,
      },
    });

    return this.toPublic(report);
  }

  /**
   * Admin review queue. Default ordering is oldest-first (PENDING reports
   * should not starve behind a flood of new ones), filterable by status.
   */
  async list(query: ListReportsQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.targetType) where.targetType = query.targetType;
    if (query.targetId) where.targetId = query.targetId;

    const [rows, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: query.order ?? 'asc' },
        skip: query.skip,
        take: query.take,
        include: { reporter: { select: { id: true, username: true } } },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toPublic(r)),
      total,
      page: query.page ?? 1,
      limit: query.take,
    };
  }

  async getById(id: string): Promise<ReportPublic> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { reporter: { select: { id: true, username: true } } },
    });
    if (!report) throw new NotFoundException('Report not found');
    return this.toPublic(report);
  }

  /**
   * Triage transition. `reviewedById`/`reviewedAt` are stamped from the
   * verified token identity — a client can never claim someone else
   * reviewed a report. Every transition lands in the audit trail.
   */
  async update(id: string, reviewerId: string, reviewerUsername: string, dto: UpdateReportDto): Promise<ReportPublic> {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    if (dto.status && dto.status !== 'PENDING' && dto.status !== 'REVIEWING' && report.status === dto.status && !dto.resolutionNote) {
      throw new BadRequestException(`Report is already ${dto.status}`);
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNote: dto.resolutionNote,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      include: { reporter: { select: { id: true, username: true } } },
    });

    await this.audit.record({
      actorId: reviewerId,
      action: 'report.review',
      targetType: 'REPORT',
      targetId: id,
      metadata: {
        status: dto.status ?? updated.status,
        resolutionNote: dto.resolutionNote ?? null,
        reporterUsername: reviewerUsername,
        reportedTarget: `${updated.targetType}:${updated.targetId}`,
      },
    });

    return this.toPublic(updated);
  }

  private toPublic(report: {
    id: string;
    targetType: ReportPublic['targetType'];
    targetId: string;
    reason: ReportPublic['reason'];
    description: string | null;
    status: ReportPublic['status'];
    reviewedAt: Date | null;
    resolutionNote: string | null;
    createdAt: Date;
    reporter?: { id: string; username: string } | null;
  }): ReportPublic {
    return {
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      description: report.description,
      status: report.status,
      resolutionNote: report.resolutionNote,
      reviewedAt: report.reviewedAt ? report.reviewedAt.toISOString() : null,
      reporter: report.reporter ?? null,
      createdAt: report.createdAt.toISOString(),
    };
  }
}
