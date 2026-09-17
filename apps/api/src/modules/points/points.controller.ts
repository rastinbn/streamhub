import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type RequestWithUser } from '../../common/guards/jwt-auth.guard';
import { PointsService } from './points.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Viewer points — read endpoints. Awards happen automatically (watch-time
 * via the analytics flush, chat via the gateway); spends happen through the
 * meme-play socket event. No client-facing write endpoints exist: balances
 * can only move through the audited service paths.
 */
@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly points: PointsService) {}

  /** Caller's wallet + latest ledger page. */
  @Get('me')
  async me(@Req() req: RequestWithUser, @Query() query: PaginationQueryDto) {
    return {
      success: true,
      data: await this.points.getMyPoints(req.user.sub, query.page ?? 1, query.limit ?? 20),
    };
  }
}
