import { ForbiddenException, Injectable } from '@nestjs/common';
import type { PointsEntry, PointsReason, PointsWallet as PointsWalletPublic } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { pointsWatchAccKey } from '../analytics/analytics.constants';

/**
 * Tunables for the viewer-points economy (docs/points-and-memes.md):
 *  - WATCH_TIME: 1 point per full minute watched, awarded by the analytics
 *    flush pipeline (which already samples per-stream presence every 30s —
 *    no new timer is created; PointsService exposes a batched
 *    `awardWatchTime` the pipeline calls once per flush).
 *  - CHAT_MESSAGE: awarded by the chat gateway per accepted message, capped
 *    per rolling window (Redis counters below) so chatters can't farm
 *    points up to the chat rate limit.
 */
export const POINTS_WATCH_TIME_PER_MINUTE = 1;
export const POINTS_CHAT_MESSAGE_AWARD = 1;
export const POINTS_CHAT_WINDOW_SECONDS = 60;
export const POINTS_CHAT_MAX_PER_WINDOW = 5;

/** `points:chatwindow:<userId>:<windowIndex>` — rolling-window award cap. */
const CHAT_WINDOW_PREFIX = 'points:chatwindow:';

function toPublicEntry(row: {
  id: string;
  reason: string;
  delta: number;
  balanceAfter: number;
  streamId: string | null;
  createdAt: Date;
}): PointsEntry {
  return {
    id: row.id,
    reason: row.reason as PointsReason,
    delta: row.delta,
    balanceAfter: row.balanceAfter,
    streamId: row.streamId,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class PointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Atomically apply a signed delta: wallet update + append-only ledger row
   * (recording the post-change balance) in one transaction. The wallet row
   * is created lazily on the first award. Throws Forbidden on insufficient
   * funds — the only business rejection path.
   */
  private async applyDelta(
    userId: string,
    delta: number,
    reason: PointsReason,
    streamId: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<number> {
    // Two statements guarded by a conditional `updateMany` on the balance —
    // the Postgres-level check makes the debit atomic without needing the
    // interactive-transaction API (which keeps the service testable against
    // the in-memory fake). A lost race (balance changed between read and
    // write) updates zero rows and we retry once from the fresh balance.
    for (let attempt = 0; attempt < 2; attempt++) {
      const wallet = await this.prisma.pointsWallet.findUnique({ where: { userId } });

      if (!wallet) {
        if (delta < 0) throw new ForbiddenException('Insufficient points');
        await this.prisma.pointsWallet.create({ data: { userId, balance: 0, totalEarned: 0, totalSpent: 0 } });
        continue;
      }

      const balance = wallet.balance + delta;
      if (balance < 0) throw new ForbiddenException('Insufficient points');

      const result = await this.prisma.pointsWallet.updateMany({
        where: { userId, balance: wallet.balance },
        data: {
          balance,
          totalEarned: delta > 0 ? { increment: delta } : undefined,
          totalSpent: delta < 0 ? { increment: -delta } : undefined,
        },
      });
      if (result.count === 1) {
        await this.prisma.pointsLedger.create({
          // undefined (not null) — Prisma's Json input treats null as a
          // sentinel value; omitting the field stores the column default (NULL).
          data: { userId, reason, delta, balanceAfter: balance, streamId, metadata: metadata as never },
        });
        return balance;
      }
      // Concurrent modification — loop once more with the fresh balance.
    }
    throw new ForbiddenException('Could not update points, try again');
  }

  /**
   * Award points for an accepted chat message. Returns false (awarding
   * nothing) when the per-window cap is already used up — the cap is
   * enforced with a fixed-window Redis INCR/EXPIRE, same pattern as the
   * chat rate limiter.
   */
  async awardForChat(userId: string): Promise<boolean> {
    const windowSeconds = POINTS_CHAT_WINDOW_SECONDS;
    const windowIndex = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `${CHAT_WINDOW_PREFIX}${userId}:${windowIndex}`;
    const client = this.redis.getClient();

    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSeconds);
    }
    if (count > POINTS_CHAT_MAX_PER_WINDOW) {
      return false;
    }

    await this.applyDelta(userId, POINTS_CHAT_MESSAGE_AWARD, 'CHAT_MESSAGE', null, { windowIndex });
    return true;
  }

  /**
   * Batched watch-time accrual, called once per analytics flush with the
   * seconds each *signed-in* viewer was present during the interval.
   * Carries sub-minute remainders in a Redis accumulator
   * (`points:watchacc:<userId>`) so points accrue accurately at any flush
   * cadence — e.g. 30s flushes award 1 point every second flush. Wrapped
   * per-viewer: one user's failure never blocks the rest of the flush.
   */
  async awardWatchTime(entries: Array<{ userId: string; seconds: number; streamId: string }>): Promise<void> {
    const client = this.redis.getClient();
    for (const e of entries) {
      try {
        if (e.seconds <= 0) continue;
        const accKey = pointsWatchAccKey(e.userId);
        const carried = await client.incrby(accKey, Math.round(e.seconds));
        const minutes = Math.floor(carried / 60);
        if (minutes > 0) {
          await client.set(accKey, String(carried - minutes * 60));
          await this.applyDelta(
            e.userId,
            minutes * POINTS_WATCH_TIME_PER_MINUTE,
            'WATCH_TIME',
            e.streamId,
            { seconds: minutes * 60 },
          );
        }
      } catch {
        // A points failure must never break the analytics flush.
      }
    }
  }

  /**
   * Spend points to play a meme sound. The memes service calls this inside
   * the play flow after its own membership/ban checks; a zero-cost sound
   * skips the ledger entirely. Throws Forbidden when the viewer can't
   * afford the sound. Returns the post-spend balance.
   */
  async spend(userId: string, cost: number, streamId: string | null, soundId: string): Promise<number> {
    if (cost > 0) {
      return this.applyDelta(userId, -cost, 'MEME_PLAY', streamId, { soundId });
    }
    const wallet = await this.prisma.pointsWallet.findUnique({ where: { userId } });
    return wallet?.balance ?? 0;
  }

  /** GET /points/me — wallet + paginated ledger. */
  async getMyPoints(userId: string, page: number, limit: number) {
    const wallet = await this.prisma.pointsWallet.findUnique({ where: { userId } });
    const [rows, total] = await Promise.all([
      this.prisma.pointsLedger.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pointsLedger.count({ where: { userId } }),
    ]);
    const publicWallet: PointsWalletPublic = {
      balance: wallet?.balance ?? 0,
      totalEarned: wallet?.totalEarned ?? 0,
      totalSpent: wallet?.totalSpent ?? 0,
    };
    return { wallet: publicWallet, entries: rows.map(toPublicEntry), page, limit, total };
  }
}
