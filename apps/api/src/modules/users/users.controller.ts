import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';
import { ChannelsService } from '../channels/channels.service';
import { FollowsService } from '../follows/follows.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly channels: ChannelsService,
    private readonly follows: FollowsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Get('me/channel')
  async getMyChannel(@Req() req: RequestWithUser) {
    return { success: true, data: await this.channels.getByOwnerId(req.user.sub) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Get('me/following')
  async getMyFollowing(@Req() req: RequestWithUser, @Query() query: PaginationQueryDto) {
    return { success: true, data: await this.follows.listFollowing(req.user.sub, query) };
  }

  @Get(':username')
  async getProfile(@Param('username') username: string) {
    return { success: true, data: await this.users.getProfile(username) };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Patch('me')
  async updateProfile(@Req() req: RequestWithUser, @Body() dto: UpdateProfileDto) {
    return { success: true, data: await this.users.updateProfile(req.user.sub, dto) };
  }
}
