import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { toPublicUser } from '../../common/mappers';
import { TokenService } from './token.service';
import { EmailVerificationService } from './email-verification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { UserPublic } from '@streamhub/types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly redis: RedisService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: UserPublic; accessToken: string; refreshToken: string }> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email }] },
    });
    if (existing) {
      if (existing.username === dto.username) {
        throw new ConflictException('Username already taken');
      }
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { username: dto.username, email: dto.email, passwordHash, role: 'USER' },
    });

    // Issue a verification email for the new account. The user can keep
    // browsing (a session was issued above); clicking the emailed link
    // confirms ownership of the address and flips `emailVerified`.
    await this.emailVerification.sendVerificationEmail(user.id, user.email);

    const tokens = await this.tokens.signAuthTokens({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return { user: toPublicUser(user), ...tokens };
  }

  /**
   * Consumes a verification token and returns a fresh session for the now-
   * verified user, so clicking the emailed link logs them straight in.
   */
  async verifyEmail(rawToken: string): Promise<{ user: UserPublic; accessToken: string; refreshToken: string }> {
    const { userId } = await this.emailVerification.verifyToken(rawToken);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const tokens = await this.tokens.signAuthTokens({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return { user: toPublicUser(user), ...tokens };
  }

  /**
   * Re-emails a verification link to an existing, still-unverified account.
   * Deliberately silent on unknown emails / already-verified accounts so
   * this endpoint can't be used to enumerate registered addresses.
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) return;

    await this.emailVerification.sendVerificationEmail(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<{ user: UserPublic; accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { username: dto.identifier }] },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.tokens.signAuthTokens({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return { user: toPublicUser(user), ...tokens };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const payload = await this.tokens.verifyRefreshToken(refreshToken);
      await this.tokens.revokeRefreshToken(payload.sub, payload.jti);
    } catch {
      // Already revoked or expired — nothing to do.
    }
  }

  async refresh(refreshToken: string): Promise<{ user: UserPublic; accessToken: string; refreshToken: string }> {
    const payload = await this.tokens.verifyRefreshToken(refreshToken);

    // Rotate: revoke the presented token and issue a fresh pair.
    await this.tokens.revokeRefreshToken(payload.sub, payload.jti);

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const tokens = await this.tokens.signAuthTokens({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return { user: toPublicUser(user), ...tokens };
  }

  async me(userId: string): Promise<UserPublic> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return toPublicUser(user);
  }
}
