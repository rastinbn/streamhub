import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import { LayoutsService } from './layouts.service';
import { PutLayoutDto } from './dto/put-layout.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';

/**
 * Owner-only layout endpoints. Ownership is never taken from the request
 * body or query — the channel is resolved from `req.user.sub` (the JWT
 * subject) via the unique `Channel.ownerId`, so no ID swap can touch
 * another streamer's layout.
 */
@Controller('users/me/channel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
export class MyLayoutsController {
  constructor(private readonly layouts: LayoutsService) {}

  @Get('layout')
  async getMyLayout(@Req() req: RequestWithUser) {
    return { success: true, data: await this.layouts.getMyLayout(req.user.sub) };
  }

  @Put('layout')
  async putDraft(@Req() req: RequestWithUser, @Body() dto: PutLayoutDto) {
    return { success: true, data: await this.layouts.putDraft(req.user.sub, dto.layout) };
  }

  @Post('layout/publish')
  @HttpCode(200)
  async publish(@Req() req: RequestWithUser) {
    return { success: true, data: await this.layouts.publish(req.user.sub) };
  }

  @Post('layout/reset')
  @HttpCode(200)
  async reset(@Req() req: RequestWithUser) {
    return { success: true, data: await this.layouts.reset(req.user.sub) };
  }
}
