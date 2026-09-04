import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { StreamPublic, StreamStatusView, StreamWithKey } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { toPublicStream } from '../../common/mappers';
import { generateStreamKey, hashStreamKey } from './stream-key.util';
import { CreateStreamDto } from './dto/create-stream.dto';
import { UpdateStreamDto } from './dto/update-stream.dto';
import { ListStreamsQueryDto } from './dto/list-streams-query.dto';

@Injectable()
export class StreamsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Browse/search streams — deliberately NOT cached. `status`/`viewerCount`
   * are exactly the "dynamic live state" the task says not to over-cache: a
   * cached page could show a stream as LIVE minutes after it ended, or miss
   * one that just went live. See docs/api-contract.md's Performance note.
   */
  async list(query: ListStreamsQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' as const };
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.stream.findMany({
        where,
        orderBy: { [query.sortBy ?? 'viewerCount']: query.order ?? 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.stream.count({ where }),
    ]);

    return {
      items: items.map((s: unknown) => toPublicStream(s as { streamKeyHash: unknown })),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  /**
   * `GET /streams/live` — shorthand for `list({ status: 'LIVE' })`.
   *
   * Mutates `status` on the existing DTO instance rather than spreading it
   * into a new plain object (`{ ...query, status: 'LIVE' }`) — `skip`/
   * `take` are getters defined on `PaginationQueryDto`'s prototype, not own
   * properties, so a spread silently drops them, leaving `list()` with
   * `skip`/`take` both `undefined` and no pagination limit applied at all.
   */
  async listLive(query: ListStreamsQueryDto) {
    query.status = 'LIVE';
    return this.list(query);
  }

  /**
   * Creates a new stream session for the caller's own channel. Mirrors
   * `ChannelsService.create`'s pattern of deriving ownership server-side —
   * the caller never supplies `channelId` directly.
   */
  async create(requesterId: string, dto: CreateStreamDto): Promise<StreamWithKey> {
    const channel = await this.prisma.channel.findUnique({ where: { ownerId: requesterId } });
    if (!channel) {
      throw new NotFoundException('You do not have a channel yet');
    }

    // One live broadcast at a time per channel (see docs/domain-model.md
    // §5 "open items" — this is the service-level enforcement flagged
    // there as not-yet-implemented).
    const activeStream = await this.prisma.stream.findFirst({
      where: { channelId: channel.id, status: 'LIVE' },
    });
    if (activeStream) {
      throw new ConflictException('This channel already has a live stream');
    }

    const rawKey = generateStreamKey();
    const stream = await this.prisma.stream.create({
      data: {
        channelId: channel.id,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        thumbnail: dto.thumbnail,
        streamKeyHash: hashStreamKey(rawKey),
      },
    });

    return { ...toPublicStream(stream), streamKey: rawKey };
  }

  async getById(id: string): Promise<StreamPublic> {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }
    return toPublicStream(stream);
  }

  async getStatus(id: string): Promise<StreamStatusView> {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }
    return {
      id: stream.id,
      status: stream.status,
      viewerCount: stream.viewerCount,
      startedAt: stream.startedAt,
      endedAt: stream.endedAt,
    } as unknown as StreamStatusView;
  }

  async update(id: string, requesterId: string, dto: UpdateStreamDto): Promise<StreamPublic> {
    const stream = await this.getOwnedStreamOrThrow(id, requesterId);

    const updated = await this.prisma.stream.update({
      where: { id: stream.id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        thumbnail: dto.thumbnail,
      },
    });

    return toPublicStream(updated);
  }

  /**
   * Issues a brand-new stream key, invalidating any previous one. The raw
   * key is returned exactly once — the caller (channel owner) must copy it
   * into OBS immediately; only its hash is retrievable from then on.
   */
  async rotateKey(id: string, requesterId: string): Promise<StreamWithKey> {
    const stream = await this.getOwnedStreamOrThrow(id, requesterId);

    const rawKey = generateStreamKey();
    const updated = await this.prisma.stream.update({
      where: { id: stream.id },
      data: { streamKeyHash: hashStreamKey(rawKey) },
    });

    return { ...toPublicStream(updated), streamKey: rawKey };
  }

  /**
   * Revokes the current stream key without issuing a replacement. A stream
   * in this state cannot authenticate a new publish until `rotateKey` is
   * called again. If the stream happens to be live when revoked, the
   * session is also ended immediately — an active broadcast should not be
   * allowed to keep running under a key its owner just invalidated.
   */
  async revokeKey(id: string, requesterId: string): Promise<StreamPublic> {
    const stream = await this.getOwnedStreamOrThrow(id, requesterId);
    const wasLive = stream.status === 'LIVE';

    const updated = await this.prisma.stream.update({
      where: { id: stream.id },
      data: {
        streamKeyHash: null,
        status: wasLive ? 'ENDED' : stream.status,
        endedAt: wasLive ? new Date() : stream.endedAt,
      },
    });

    return toPublicStream(updated);
  }

  /**
   * Called by the MediaMTX publish webhook when OBS begins publishing.
   * Looks the presented raw key up by its hash; returns `null` (rather than
   * throwing) when no match is found so the controller can deny the
   * publish attempt without leaking whether the key format was merely
   * invalid vs. genuinely unknown/revoked.
   */
  async handlePublish(rawKey: string): Promise<StreamPublic | null> {
    const stream = await this.prisma.stream.findUnique({
      where: { streamKeyHash: hashStreamKey(rawKey) },
    });
    if (!stream) return null;

    // Idempotent: MediaMTX may re-fire publish notifications; only
    // transition (and stamp startedAt) the first time.
    if (stream.status === 'LIVE') {
      return toPublicStream(stream);
    }

    const updated = await this.prisma.stream.update({
      where: { id: stream.id },
      data: { status: 'LIVE', startedAt: new Date(), endedAt: null },
    });

    return toPublicStream(updated);
  }

  /**
   * Called by the MediaMTX unpublish webhook when OBS stops publishing (or
   * disconnects). Idempotent and forgiving: an unknown key or a stream
   * that's already OFFLINE/ENDED is a no-op, not an error — MediaMTX should
   * never be blocked by a webhook failure on disconnect.
   */
  async handleUnpublish(rawKey: string): Promise<StreamPublic | null> {
    const stream = await this.prisma.stream.findUnique({
      where: { streamKeyHash: hashStreamKey(rawKey) },
    });
    if (!stream || stream.status !== 'LIVE') {
      return stream ? toPublicStream(stream) : null;
    }

    const updated = await this.prisma.stream.update({
      where: { id: stream.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    return toPublicStream(updated);
  }

  /** Loads a stream and enforces that `requesterId` owns its parent channel. */
  private async getOwnedStreamOrThrow(id: string, requesterId: string) {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }

    const channel = await this.prisma.channel.findUnique({ where: { id: stream.channelId } });
    if (!channel || channel.ownerId !== requesterId) {
      throw new ForbiddenException('You do not have permission to manage this stream');
    }

    return stream;
  }
}
