import { Body, Controller, Delete, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';
import { ModerationService } from './moderation.service';
import { BanUserDto } from './dto/ban-user.dto';
import { SuspendChannelDto } from './dto/suspend-channel.dto';
import { ChatModerationActionDto } from './dto/chat-moderation-action.dto';
import { RemoveContentDto } from './dto/remove-content.dto';

/**
 * Phase 10 — platform moderation. Every route requires a valid JWT plus the
 * MODERATOR or ADMIN role; the guard chain (JwtAuthGuard → RolesGuard)
 * rejects USER/STREAMER callers with 403 before any handler runs.
 */
@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'ADMIN')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post('users/:id/ban')
  async banUser(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: BanUserDto) {
    return { success: true, data: await this.moderation.banUser(req.user.sub, id, dto) };
  }

  @HttpCode(200)
  @Delete('users/:id/ban')
  async unbanUser(@Req() req: RequestWithUser, @Param('id') id: string) {
    return { success: true, data: await this.moderation.unbanUser(req.user.sub, id) };
  }

  @Post('channels/:id/suspend')
  async suspendChannel(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: SuspendChannelDto) {
    return { success: true, data: await this.moderation.suspendChannel(req.user.sub, id, dto) };
  }

  @HttpCode(200)
  @Delete('channels/:id/suspend')
  async unsuspendChannel(@Req() req: RequestWithUser, @Param('id') id: string) {
    return { success: true, data: await this.moderation.unsuspendChannel(req.user.sub, id) };
  }

  @Post('chat')
  async chatAction(@Req() req: RequestWithUser, @Body() dto: ChatModerationActionDto) {
    return { success: true, data: await this.moderation.chatAction(req.user.sub, dto) };
  }

  @Post('content/:id/remove')
  async removeContent(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: RemoveContentDto) {
    return { success: true, data: await this.moderation.removeContent(req.user.sub, id, dto) };
  }
}
