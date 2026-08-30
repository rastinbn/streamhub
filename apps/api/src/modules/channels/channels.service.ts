import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ChannelPublic } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { toPublicChannel } from '../../common/mappers';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateChannelDto): Promise<ChannelPublic> {
    // A user owns at most one channel (Channel.ownerId is unique).
    const existingForOwner = await this.prisma.channel.findUnique({ where: { ownerId } });
    if (existingForOwner) {
      throw new ConflictException('You already have a channel');
    }

    const existingSlug = await this.prisma.channel.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) {
      throw new ConflictException('Slug already taken');
    }

    const channel = await this.prisma.channel.create({
      data: {
        ownerId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        avatar: dto.avatar,
        banner: dto.banner,
        category: dto.category,
      },
    });

    return toPublicChannel(channel);
  }

  async getBySlug(slug: string): Promise<ChannelPublic> {
    const channel = await this.prisma.channel.findUnique({ where: { slug } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    return toPublicChannel(channel);
  }

  async getByOwnerId(ownerId: string): Promise<ChannelPublic> {
    const channel = await this.prisma.channel.findUnique({ where: { ownerId } });
    if (!channel) {
      throw new NotFoundException('You do not have a channel yet');
    }
    return toPublicChannel(channel);
  }

  async update(channelId: string, requesterId: string, dto: UpdateChannelDto): Promise<ChannelPublic> {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    // Ownership check — only the owning user (any role) may modify their
    // own channel. Moderator/admin channel takeover is a future concern and
    // deliberately not implemented here.
    if (channel.ownerId !== requesterId) {
      throw new ForbiddenException('You do not have permission to modify this channel');
    }

    if (dto.slug && dto.slug !== channel.slug) {
      const existingSlug = await this.prisma.channel.findUnique({ where: { slug: dto.slug } });
      if (existingSlug) {
        throw new ConflictException('Slug already taken');
      }
    }

    const updated = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        avatar: dto.avatar,
        banner: dto.banner,
        category: dto.category,
      },
    });

    return toPublicChannel(updated);
  }
}
