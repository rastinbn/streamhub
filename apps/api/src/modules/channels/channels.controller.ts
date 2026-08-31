import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Post()
  async create(@Req() req: RequestWithUser, @Body() dto: CreateChannelDto) {
    return { success: true, data: await this.channels.create(req.user.sub, dto) };
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return { success: true, data: await this.channels.getBySlug(slug) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Patch(':id')
  async update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return { success: true, data: await this.channels.update(id, req.user.sub, dto) };
  }
}
