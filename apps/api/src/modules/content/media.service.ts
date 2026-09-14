import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { OBJECT_STORAGE } from '../../storage/object-storage.providers';
import type { ObjectStorageService } from '../../storage/object-storage.service';
import { MAX_THUMBNAIL_BYTES, type UploadThumbnailDto } from './dto/upload-thumbnail.dto';

const MIME_BY_FORMAT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageService,
  ) {}

  /**
   * Stores a streamer's uploaded thumbnail under their channel's prefix
   * (`thumbnails/{channelId}/{uuid}.{ext}`) and returns the media URL to
   * persist on the stream (via `CreateStreamDto.thumbnail`). The caller can
   * only ever upload into their own channel's prefix — the channel is derived
   * from the authenticated user, exactly like `StreamsService.create`.
   */
  async uploadThumbnail(
    requesterId: string,
    dto: UploadThumbnailDto,
  ): Promise<{ url: string; format: string; size: number }> {
    const channel = await this.prisma.channel.findUnique({ where: { ownerId: requesterId } });
    if (!channel) {
      throw new NotFoundException('You do not have a channel yet');
    }

    const raw = dto.data.trim();
    // Accept either a full data URL or a bare base64 body.
    const commaIndex = raw.indexOf(',');
    const hasDataHeader = raw.startsWith('data:') && commaIndex > 0 && raw.slice(0, commaIndex).includes(';base64');
    const base64 = hasDataHeader ? raw.slice(commaIndex + 1) : raw;

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      throw new BadRequestException('Invalid image data');
    }

    let bytes: Buffer;
    try {
      bytes = Buffer.from(base64, 'base64');
    } catch {
      throw new BadRequestException('Invalid image data');
    }
    if (bytes.length === 0) {
      throw new BadRequestException('Image is empty');
    }
    if (bytes.length > MAX_THUMBNAIL_BYTES) {
      throw new BadRequestException(`Thumbnail must be ${MAX_THUMBNAIL_BYTES / (1024 * 1024)} MB or smaller`);
    }

    const format = dto.format.toLowerCase();
    const extension = format === 'jpeg' ? 'jpg' : format;
    const key = `thumbnails/${channel.id}/${randomUUID()}.${extension}`;
    await this.storage.put(key, bytes, MIME_BY_FORMAT[format] ?? 'application/octet-stream');

    return { url: await this.storage.resolveUrl(key), format: format === 'jpeg' ? 'jpg' : format, size: bytes.length };
  }
}