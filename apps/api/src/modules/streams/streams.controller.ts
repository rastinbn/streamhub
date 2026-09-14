import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { StreamsService } from './streams.service';
import { CreateStreamDto } from './dto/create-stream.dto';
import { UpdateStreamDto } from './dto/update-stream.dto';
import { MediaMtxWebhookDto } from './dto/mediamtx-webhook.dto';
import { MediaMtxAuthDto } from './dto/mediamtx-auth.dto';
import { ListStreamsQueryDto } from './dto/list-streams-query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { MediaMtxWebhookGuard } from '../../common/guards/mediamtx-webhook.guard';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';

@Controller('streams')
export class StreamsController {
  constructor(private readonly streams: StreamsService) {}

  // --- Browse/search ----------------------------------------------------
  //
  // Registered ahead of the `:id` routes below: `GET /streams/live` has the
  // same one-segment shape as `GET /streams/:id` and, being a static path,
  // must be declared first or Nest/Express would treat "live" as an `:id`
  // value and this route would never be reached.

  @Get('live')
  async listLive(@Query() query: ListStreamsQueryDto) {
    return { success: true, data: await this.streams.listLive(query) };
  }

  @Get()
  async list(@Query() query: ListStreamsQueryDto) {
    return { success: true, data: await this.streams.list(query) };
  }

  /**
   * `GET /streams/mine` — the caller's own streams (dashboard scope),
   * newest first. Registered BEFORE `:id` so "mine" is never swallowed as
   * an id (same static-before-param convention as `/streams/live`).
   */
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async listMine(@Req() req: RequestWithUser, @Query() query: PaginationQueryDto) {
    return { success: true, data: await this.streams.listMine(req.user.sub, query) };
  }

  // --- MediaMTX lifecycle callbacks ------------------------------------
  //
  // Registered ahead of the `:id` routes below. Both `webhooks/mediamtx/*`
  // paths have more path segments than any `:id`-based route
  // (`/streams/:id`, `/streams/:id/status`, ...) so there's no actual
  // routing ambiguity — this ordering just mirrors the codebase's existing
  // defensive convention (see `UsersController`'s `me/channel` vs
  // `:username`) for readability.
  //
  // Authenticated via a shared secret (`MediaMtxWebhookGuard`), not JWT:
  // these calls originate from MediaMTX itself, not a logged-in user.

  @SkipThrottle()
  @UseGuards(MediaMtxWebhookGuard)
  @Post('webhooks/mediamtx/publish')
  async handlePublishWebhook(@Body() dto: MediaMtxWebhookDto) {
    const stream = await this.streams.handlePublish(dto.streamKey);
    // A `null` result means the presented key doesn't match any known
    // (non-revoked) stream. MediaMTX's HTTP publish-auth flow treats a
    // non-2xx response as "deny this publish attempt", so this must be a
    // real error response, not a 2xx body with `success: false`.
    if (!stream) {
      throw new UnauthorizedException('Unknown or revoked stream key');
    }
    return { success: true, data: stream };
  }

  @SkipThrottle()
  @UseGuards(MediaMtxWebhookGuard)
  @Post('webhooks/mediamtx/unpublish')
  async handleUnpublishWebhook(@Body() dto: MediaMtxWebhookDto) {
    // Always acknowledged — an unknown key or an already-ended stream on
    // disconnect is a normal, not exceptional, occurrence.
    const stream = await this.streams.handleUnpublish(dto.streamKey);
    return { success: true, data: stream };
  }

  /**
   * MediaMTX's native delegated authentication (`authMethod: http` in
   * infrastructure/streaming/mediamtx.yml). For EVERY client action MediaMTX
   * POSTs `{user, password, action, path, ...}` here and treats any 2xx as
   * allow / anything else as deny — so this endpoint answers a bare boolean
   * (no `{success, data}` envelope) and MUST keep returning 200/401 rather
   * than Nest's default error shapes.
   *
   * Authenticated by the same shared secret as the other MediaMTX
   * webhooks; MediaMTX passes it via the `?secret=` query parameter baked
   * into its authHTTPAddress, which the guard accepts alongside the
   * header.
   */
  @SkipThrottle()
  @UseGuards(MediaMtxWebhookGuard)
  @HttpCode(200)
  @Post('webhooks/mediamtx/auth')
  async authorize(@Body() body: MediaMtxAuthDto) {
    const allowed = await this.streams.authorize(body.action ?? '', body.path ?? null, body.password ?? null);
    if (!allowed) {
      // 401 (not an envelope) — the status code is the only protocol.
      throw new UnauthorizedException();
    }
    return true;
  }

  // --- Owner-managed CRUD + key lifecycle -------------------------------

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Post()
  async create(@Req() req: RequestWithUser, @Body() dto: CreateStreamDto) {
    return { success: true, data: await this.streams.create(req.user.sub, dto) };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return { success: true, data: await this.streams.getById(id) };
  }

  @Get(':id/status')
  async getStatus(@Param('id') id: string) {
    return { success: true, data: await this.streams.getStatus(id) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Patch(':id')
  async update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateStreamDto) {
    return { success: true, data: await this.streams.update(id, req.user.sub, dto) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Post(':id/rotate-key')
  async rotateKey(@Req() req: RequestWithUser, @Param('id') id: string) {
    return { success: true, data: await this.streams.rotateKey(id, req.user.sub) };
  }

  /**
   * `POST /streams/:id/end` — the owner ends their own live broadcast.
   * Same shape as rotate/revoke-key; ownership + 409-on-not-live are
   * enforced in the service.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Post(':id/end')
  async endStream(@Req() req: RequestWithUser, @Param('id') id: string) {
    return { success: true, data: await this.streams.endStream(id, req.user.sub) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Post(':id/revoke-key')
  async revokeKey(@Req() req: RequestWithUser, @Param('id') id: string) {
    return { success: true, data: await this.streams.revokeKey(id, req.user.sub) };
  }
}
