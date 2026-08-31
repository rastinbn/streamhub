import { Body, Controller, Get, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { StreamsService } from './streams.service';
import { CreateStreamDto } from './dto/create-stream.dto';
import { UpdateStreamDto } from './dto/update-stream.dto';
import { MediaMtxWebhookDto } from './dto/mediamtx-webhook.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { MediaMtxWebhookGuard } from '../../common/guards/mediamtx-webhook.guard';
import type { StreamStatus } from '@streamhub/types';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';

@Controller('streams')
export class StreamsController {
  constructor(private readonly streams: StreamsService) {}

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

  @UseGuards(MediaMtxWebhookGuard)
  @Post('webhooks/mediamtx/unpublish')
  async handleUnpublishWebhook(@Body() dto: MediaMtxWebhookDto) {
    // Always acknowledged — an unknown key or an already-ended stream on
    // disconnect is a normal, not exceptional, occurrence.
    const stream = await this.streams.handleUnpublish(dto.streamKey);
    return { success: true, data: stream };
  }

  // --- Owner-managed CRUD + key lifecycle -------------------------------

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Post()
  async create(@Req() req: RequestWithUser, @Body() dto: CreateStreamDto) {
    return { success: true, data: await this.streams.create(req.user.sub, dto) };
  }

  // Public browse/discover listing. Registered before `@Get(':id')` so the
  // literal `/streams` path isn't swallowed by the parameterized segment.
  @Get()
  async list(@Query('status') status?: StreamStatus) {
    return { success: true, data: await this.streams.findAll(status) };
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Post(':id/revoke-key')
  async revokeKey(@Req() req: RequestWithUser, @Param('id') id: string) {
    return { success: true, data: await this.streams.revokeKey(id, req.user.sub) };
  }
}
