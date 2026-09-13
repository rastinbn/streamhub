import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { UserPublic, UserProfile } from '@streamhub/types';
import { toPublicChannel, toPublicUser } from '../../common/mappers';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(username: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Public profile pages want the user's channel too; two indexed unique
    // lookups beat a join for this access pattern and keep the contract exact
    // (slug-precise channel data, never name matching).
    const channel = await this.prisma.channel.findUnique({ where: { ownerId: user.id } });
    return { ...toPublicUser(user), channel: channel ? toPublicChannel(channel) : null };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserPublic> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        avatar: dto.avatar,
        bio: dto.bio,
      },
    });
    return toPublicUser(user);
  }

  /**
   * Upgrades a regular USER account to STREAMER (idempotent — account with an
   * equal-or-higher role is returned unchanged) so the owner can stream and
   * access the creator dashboard.
   */
  async becomeStreamer(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === 'USER') {
      return this.prisma.user.update({
        where: { id: userId },
        data: { role: 'STREAMER' },
      });
    }
    return user;
  }
}
