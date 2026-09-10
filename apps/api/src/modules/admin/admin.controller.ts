import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import type { RequestWithUser } from '../../common/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { ListAdminChannelsQueryDto } from './dto/list-admin-channels-query.dto';
import { ListAdminStreamsQueryDto } from './dto/list-admin-streams-query.dto';
import { UpdateChannelDto } from '../channels/dto/update-channel.dto';

/**
 * Admin panel. Every route here is restricted to `ADMIN` — content/moderation
 * operations that must never be reachable by regular users (or streamers with
 * elevated access. The web admin UI gates visibility on the same role, and the
 * API independently re-checks it on every request.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  async overview() {
    return { success: true, data: await this.admin.overview() };
  }

  @Get('users')
  async listUsers(@Query() query: ListAdminUsersQueryDto) {
    return { success: true, data: await this.admin.listUsers(query) };
  }

  @Patch('users/:id/role')
  async updateUserRole(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return { success: true, data: await this.admin.updateUserRole(req.user.sub, id, dto.role) };
  }

  @Get('channels')
  async listChannels(@Query() query: ListAdminChannelsQueryDto) {
    return { success: true, data: await this.admin.listChannels(query) };
  }

  @Patch('channels/:id')
  async updateChannel(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return { success: true, data: await this.admin.updateChannel(id, dto) };
  }

  @Get('streams')
  async listStreams(@Query() query: ListAdminStreamsQueryDto) {
    return { success: true, data: await this.admin.listStreams(query) };
  }

  @Post('streams/:id/end')
  async endStream(@Param('id') id: string) {
    return { success: true, data: await this.admin.endStream(id) };
  }

  @Delete('streams/:id')
  async deleteStream(@Param('id') id: string) {
    return { success: true, data: await this.admin.deleteStream(id) };
  }
}