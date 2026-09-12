import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';

/**
 * Phase 10 — reports. Submission is open to every authenticated user;
 * the review queue and triage are restricted to MODERATOR/ADMIN by the
 * @Roles guard. The ADMIN-only `admin.controller.ts` stays separate so a
 * moderator (who is not an admin) can reach exactly the report endpoints
 * and none of the user/role management surface.
 */
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Any authenticated user may report content/accounts. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('reports')
  async create(@Req() req: RequestWithUser, @Body() dto: CreateReportDto) {
    return { success: true, data: await this.reports.create(req.user.sub, dto) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MODERATOR', 'ADMIN')
  @Get('admin/reports')
  async list(@Query() query: ListReportsQueryDto) {
    return { success: true, data: await this.reports.list(query) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MODERATOR', 'ADMIN')
  @Get('admin/reports/:id')
  async getById(@Param('id') id: string) {
    return { success: true, data: await this.reports.getById(id) };
  }

  /**
   * Triage. MODERATOR/ADMIN only; the actor is taken from the verified
   * token (never the body) and stamped on the report + audit trail.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MODERATOR', 'ADMIN')
  @HttpCode(200)
  @Patch('admin/reports/:id')
  async update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateReportDto) {
    return { success: true, data: await this.reports.update(id, req.user.sub, req.user.username, dto) };
  }
}
