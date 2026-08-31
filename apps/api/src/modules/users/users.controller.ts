import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';
import { ChannelsService } from '../channels/channels.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly channels: ChannelsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'STREAMER', 'MODERATOR', 'ADMIN')
  @Get('me/channel')
  async getMyChannel(@Req() req: RequestWithUser) {
    return { success: true, data: await this.channels.getByOwnerId(req.user.sub) };
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
