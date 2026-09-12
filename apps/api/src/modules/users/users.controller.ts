import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';
import type { AuthResponse } from '@streamhub/types';
import { toPublicUser } from '../../common/mappers';
import { TokenService } from '../auth/token.service';
import { ChannelsService } from '../channels/channels.service';
import { FollowsService } from '../follows/follows.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly channels: ChannelsService,
    private readonly follows: FollowsService,
  ) {}

  /**
   * Upgrades the caller to a STREAMER (idempotent) and returns a fresh token
   * pair. The JWT guard trusts the role embedded in the access token, so the
   * role flip is only visible to the client once the old token is replaced.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('me/become-streamer')
  async becomeStreamer(@Req() req: RequestWithUser): Promise<{ success: true; data: AuthResponse }> {
    const user = await this.users.becomeStreamer(req.user.sub);
    const tokens = await this.tokens.signAuthTokens({
      id: user.id,
      username: user.username,
      role: user.role,
    });
    return { success: true, data: { user: toPublicUser(user), ...tokens } };
  }

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
