import { Injectable, UnauthorizedException } from '@nestjs/common';
import { sign, verify } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { Role } from '@streamhub/types';
import { RedisService } from '../../redis/redis.service';

interface TokenSubject {
  id: string;
  username: string;
  role: Role;
}

interface RefreshPayload {
  sub: string;
  jti: string;
}

const ACCESS_TTL = '15m';
const REFRESH_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

/**
 * Issues and verifies JWT access/refresh tokens.
 *
 * - Access token: short-lived (15m), carries sub/username/role.
 * - Refresh token: long-lived (7d) with a `jti`, stored in Redis so it can be
 *   individually revoked (logout) or rotated. Redis lookup is required on every
 *   refresh, so a logged-out token is rejected even if still cryptographically valid.
 */
@Injectable()
export class TokenService {
  private readonly accessSecret = process.env.JWT_SECRET ?? 'dev-access-secret';
  private readonly refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret';

  constructor(private readonly redis: RedisService) {}

  async signAuthTokens(subject: TokenSubject): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = sign(
      { sub: subject.id, username: subject.username, role: subject.role },
      this.accessSecret,
      { expiresIn: ACCESS_TTL },
    );

    const jti = randomUUID();
    const refreshToken = sign({ sub: subject.id, jti }, this.refreshSecret, {
      expiresIn: REFRESH_TTL_SEC,
    });

    await this.redis
      .getClient()
      .set(`auth:refresh:${subject.id}:${jti}`, '1', 'EX', REFRESH_TTL_SEC);

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): { sub: string; username: string; role: Role } {
    return verify(token, this.accessSecret) as { sub: string; username: string; role: Role };
  }

  async verifyRefreshToken(token: string): Promise<RefreshPayload> {
    // A token that fails signature/format/expiry checks is just as invalid
    // as a revoked one — always a clean 401, never an unhandled
    // JsonWebTokenError (which would surface as a 500).
    let payload: RefreshPayload;
    try {
      payload = verify(token, this.refreshSecret) as RefreshPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const stored = await this.redis.getClient().get(`auth:refresh:${payload.sub}:${payload.jti}`);
    if (!stored) {
      throw new UnauthorizedException('Refresh token has been revoked or expired');
    }
    return payload;
  }

  async revokeRefreshToken(userId: string, jti: string): Promise<void> {
    await this.redis.getClient().del(`auth:refresh:${userId}:${jti}`);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const client = this.redis.getClient();
    const keys = await this.scanKeys(client, `auth:refresh:${userId}:*`);
    if (keys.length) await client.del(...keys);
  }

  private async scanKeys(client: Redis, pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, found] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      keys.push(...found);
    } while (cursor !== '0');
    return keys;
  }
}
