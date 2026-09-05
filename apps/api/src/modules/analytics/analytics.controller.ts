import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ViewerHeartbeatDto } from './dto/viewer-heartbeat.dto';
import { OverviewQueryDto } from './dto/overview-query.dto';
import { ViewerTimelineQueryDto } from './dto/viewer-timeline-query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * Viewer presence ingestion — called by stream players, NOT the streamer.
   * Deliberately unauthenticated (guests count as viewers) and a pure Redis
   * write; see `AnalyticsService.recordHeartbeat`. A heartbeat for a stream
   * that isn't live is accepted-but-ignored (`accepted: false`) rather than
   * an error, so a player whose broadcast ended simply stops counting
   * without spewing 4xx traffic.
   */
  @Post('streams/:streamId/heartbeat')
  async heartbeat(@Param('streamId') streamId: string, @Body() dto: ViewerHeartbeatDto) {
    return {
      success: true,
      data: await this.analytics.recordHeartbeat(streamId, dto.viewerId),
    };
  }

  /** Trailing-window totals for the caller's own channel. */
  @UseGuards(JwtAuthGuard)
  @Get('overview')
  async overview(@Req() req: RequestWithUser, @Query() query: OverviewQueryDto) {
    return { success: true, data: await this.analytics.overview(req.user.sub, query.days ?? 30) };
  }

  /** Paginated per-stream analytics for the caller's own channel. */
  @UseGuards(JwtAuthGuard)
  @Get('streams')
  async listStreams(@Req() req: RequestWithUser, @Query() query: PaginationQueryDto) {
    return {
      success: true,
      data: await this.analytics.listStreams(req.user.sub, query.page ?? 1, query.limit ?? 20),
    };
  }

  /** One stream's analytics (caller must own its channel). */
  @UseGuards(JwtAuthGuard)
  @Get('streams/:streamId')
  async getStreamAnalytics(@Req() req: RequestWithUser, @Param('streamId') streamId: string) {
    return { success: true, data: await this.analytics.getStreamAnalytics(req.user.sub, streamId) };
  }

  /** Viewer-over-time timeline for one of the caller's own streams. */
  @UseGuards(JwtAuthGuard)
  @Get('viewers')
  async getViewerTimeline(@Req() req: RequestWithUser, @Query() query: ViewerTimelineQueryDto) {
    return { success: true, data: await this.analytics.getViewerTimeline(req.user.sub, query.streamId) };
  }
}
