import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import { getSecret } from '../../common/config/secrets';
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
   *
   * Optional auth: when a valid Bearer token is present, the caller is also
   * enrolled in watch-time points (Phase 12) via a shadow presence key.
   * An invalid/expired token is silently ignored — the heartbeat itself
   * never fails on auth.
   */
  @Post('streams/:streamId/heartbeat')
  async heartbeat(
    @Param('streamId') streamId: string,
    @Body() dto: ViewerHeartbeatDto,
    @Headers('authorization') authorization?: string,
  ) {
    let userId: string | undefined;
    if (authorization?.startsWith('Bearer ')) {
      try {
        const payload = verify(authorization.slice('Bearer '.length), getSecret('JWT_SECRET', 'dev-access-secret')) as {
          sub: string;
        };
        userId = payload.sub;
      } catch {
        // Invalid token — treat as anonymous.
      }
    }
    return {
      success: true,
      data: await this.analytics.recordHeartbeat(streamId, dto.viewerId, userId),
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
