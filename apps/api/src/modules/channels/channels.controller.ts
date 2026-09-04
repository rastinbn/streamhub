import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ListChannelsQueryDto } from './dto/list-channels-query.dto';
import { FollowsService } from '../follows/follows.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';

@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channels: ChannelsService,
    private readonly follows: FollowsService,
  ) {}

  @Get()
  async list(@Query() query: ListChannelsQueryDto) {
    return { success: true, data: await this.channels.list(query) };
  }

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Post(':id/follow')
  async follow(@Req() req: RequestWithUser, @Param('id') id: string) {
    return { success: true, data: await this.follows.follow(req.user.sub, id) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @HttpCode(200)
  @Delete(':id/follow')
  async unfollow(@Req() req: RequestWithUser, @Param('id') id: string) {
    return { success: true, data: await this.follows.unfollow(req.user.sub, id) };
  }

  @Get(':id/followers')
  async followers(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return { success: true, data: await this.follows.listFollowers(id, query) };
  }
}
