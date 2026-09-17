import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { MemeSoundListResponse, MemeSoundOwner, MemeSoundPublic } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { OBJECT_STORAGE } from '../../storage/object-storage.providers';
import type { ObjectStorageService } from '../../storage/object-storage.service';
import { PointsService } from '../points/points.service';
import { MAX_MEME_BYTES, MEME_MIME_BY_FORMAT } from './memes.constants';
import type { MemeAudioFormat } from '@streamhub/types';
import type { UploadMemeDto, UpdateMemeDto } from './dto/memes.dto';

const MIME_BY_FORMAT: Record<MemeAudioFormat, string> = MEME_MIME_BY_FORMAT;

interface MemeRow {
  id: string;
  channelId: string;
  title: string;
  storageKey: string;
  price: number;
  durationSeconds: number;
  playCount: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toPublic(row: MemeRow): MemeSoundPublic {
  return {
    id: row.id,
    channelId: row.channelId,
    title: row.title,
    price: row.price,
    durationSeconds: row.durationSeconds,
    playCount: row.playCount,
    soundUrl: `/api/v1/media/${row.storageKey}`,
    createdAt: row.createdAt.toISOString(),
  };
}

function toOwner(row: MemeRow): MemeSoundOwner {
  return { ...toPublic(row), active: row.active, storageKey: row.storageKey };
}

@Injectable()
export class MemesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageService,
    private readonly points: PointsService,
  ) {}

  /** Caller must own the channel — resolved server-side, never from body. */
  private async requireOwnedChannel(userId: string): Promise<{ id: string }> {
    const channel = await this.prisma.channel.findUnique({ where: { ownerId: userId } });
    if (!channel) throw new NotFoundException('You do not have a channel yet');
    return channel;
  }

  /**
   * Owner uploads a short audio clip. Stored under the channel's own
   * prefix in object storage (same provider-agnostic abstraction as
   * thumbnails/VODs — audio never lives in Postgres). Enforces a hard
   * per-file size cap; format is validated at the DTO layer.
   */
  async upload(userId: string, dto: UploadMemeDto): Promise<MemeSoundOwner> {
    const channel = await this.requireOwnedChannel(userId);

    const raw = dto.data.trim();
    const commaIndex = raw.indexOf(',');
    const hasDataHeader = raw.startsWith('data:') && commaIndex > 0 && raw.slice(0, commaIndex).includes(';base64');
    const base64 = hasDataHeader ? raw.slice(commaIndex + 1) : raw;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      throw new BadRequestException('Invalid audio data');
    }
    let bytes: Buffer;
    try {
      bytes = Buffer.from(base64, 'base64');
    } catch {
      throw new BadRequestException('Invalid audio data');
    }
    if (bytes.length === 0) throw new BadRequestException('Audio file is empty');
    if (bytes.length > MAX_MEME_BYTES) {
      throw new BadRequestException(`Meme sound must be ${MAX_MEME_BYTES / (1024 * 1024)} MB or smaller`);
    }

    const key = `memes/${channel.id}/${randomUUID()}.${dto.format}`;
    await this.storage.put(key, bytes, MIME_BY_FORMAT[dto.format] ?? 'application/octet-stream');

    const row = await this.prisma.memeSound.create({
      data: {
        channelId: channel.id,
        title: dto.title.trim(),
        storageKey: key,
        price: dto.price,
        durationSeconds: dto.durationSeconds ?? 0,
      },
    });
    return toOwner(row);
  }

  /** Owner's own sounds (including inactive), newest first. */
  async listMine(userId: string): Promise<MemeSoundOwner[]> {
    const channel = await this.requireOwnedChannel(userId);
    const rows = await this.prisma.memeSound.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toOwner);
  }

  /** Public list for a channel's chat board — active sounds only. */
  async listForChannel(channelId: string): Promise<MemeSoundListResponse> {
    const [rows, total] = await Promise.all([
      this.prisma.memeSound.findMany({
        where: { channelId, active: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.memeSound.count({ where: { channelId, active: true } }),
    ]);
    return { items: rows.map(toPublic), total };
  }

  /** Owner-only metadata edit (title/price/active toggle). */
  async update(userId: string, soundId: string, dto: UpdateMemeDto): Promise<MemeSoundOwner> {
    const channel = await this.requireOwnedChannel(userId);
    const row = await this.prisma.memeSound.findUnique({ where: { id: soundId } });
    if (!row || row.channelId !== channel.id) throw new NotFoundException('Meme sound not found');

    const updated = await this.prisma.memeSound.update({
      where: { id: soundId },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        price: dto.price !== undefined ? dto.price : undefined,
        active: dto.active !== undefined ? dto.active : undefined,
      },
    });
    return toOwner(updated);
  }

  /** Owner-only hard delete — removes the storage object too. */
  async remove(userId: string, soundId: string): Promise<void> {
    const channel = await this.requireOwnedChannel(userId);
    const row = await this.prisma.memeSound.findUnique({ where: { id: soundId } });
    if (!row || row.channelId !== channel.id) throw new NotFoundException('Meme sound not found');
    await this.prisma.memeSound.delete({ where: { id: soundId } });
    await this.storage.delete(row.storageKey).catch(() => undefined);
  }

  /**
   * The play flow's core: resolve the sound server-side, charge the
   * player, bump playCount. Returns everything the gateway needs to
   * broadcast. Throws Forbidden when the viewer can't afford the sound.
   * Debiting happens BEFORE the broadcast: a points failure means no play.
   */
  async play(userId: string, username: string, streamId: string, soundId: string): Promise<MemeSoundPublic> {
    const ctx = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: { channel: { select: { id: true } } },
    });
    if (!ctx) throw new NotFoundException('Stream not found');

    const sound = await this.prisma.memeSound.findUnique({ where: { id: soundId } });
    if (!sound || sound.channelId !== ctx.channel.id || !sound.active) {
      throw new NotFoundException('Meme sound not found');
    }

    const balance = await this.points.spend(userId, sound.price, streamId, sound.id);

    await this.prisma.memeSound.update({
      where: { id: sound.id },
      data: { playCount: { increment: 1 } },
    });

    return { ...toPublic(sound), ...(balance !== undefined ? {} : {}) };
  }
}
