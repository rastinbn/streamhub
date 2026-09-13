import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { RecordingCompletedDto } from './dto/recording-completed.dto';
import { ListContentQueryDto } from './dto/list-content-query.dto';
import { UpdateVodDto } from './dto/update-vod.dto';
import { JwtAuthGuard, RequestWithUser } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { MediaMtxWebhookGuard } from '../../common/guards/mediamtx-webhook.guard';

/**
 * Phase 9 — VOD & Content. Visibility semantics:
 *  - `GET /content` is public but only returns PUBLIC rows (plus the
 *    caller's own UNLISTED/PRIVATE rows when a valid token is present).
 *  - `GET /content/:id` is public; UNLISTED is reachable by id, PRIVATE
 *    only for the owner (or an admin).
 *  - PATCH/DELETE are strictly owner-only.
 */
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async list(@Req() req: RequestWithUser, @Query() query: ListContentQueryDto) {
    // Auth is optional here: a valid token widens visibility to the
    // caller's own content; anonymous callers see PUBLIC only.
    const requesterId = this.getRequesterId(req);

    // `mine=true` is the streamer-dashboard scope: ONLY the caller's own
    // VODs, all visibilities. It has no meaning anonymously — an
    // unauthenticated request asking for "my content" is 401, not an
    // empty PUBLIC list (which would silently look like "you have no
    // content" in a broken-auth client).
    const mine = query.mine === 'true';
    if (mine && !requesterId) {
      throw new UnauthorizedException('Authentication required for mine=true');
    }

    return {
      success: true,
      data: await this.content.list({
        requesterId,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        mine,
      }),
    };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getById(@Req() req: RequestWithUser, @Param('id') id: string) {
    return { success: true, data: await this.content.getById(id, this.getRequesterId(req), this.isAdmin(req)) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateVodDto) {
    return { success: true, data: await this.content.update(id, req.user.sub, dto) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Req() req: RequestWithUser, @Param('id') id: string) {
    await this.content.delete(id, req.user.sub);
    return { success: true, data: null };
  }

  /** Returns the caller id if a valid Bearer token is present, else undefined. */
  private getRequesterId(req: RequestWithUser): string | undefined {
    return req.user?.sub;
  }

  private isAdmin(req: RequestWithUser): boolean {
    return req.user?.role === 'ADMIN';
  }
}
