import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../mail/mail.service';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Issues and verifies email-confirmation tokens.
 *
 * Only a SHA-256 hash of the token is ever persisted (same pattern as
 * `Stream.streamKeyHash`) — the raw token exists only in the emailed link
 * and is never recoverable from the database.
 */
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Creates a fresh token for the user and emails the verification link. */
  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:3000';
    const verifyUrl = `${webAppUrl}/verify-email?token=${rawToken}`;

    await this.mail.sendVerificationEmail(email, verifyUrl);
  }

  /**
   * Marks the token (and the owning user) as verified. Throws if the token
   * is unknown, already used, or expired.
   */
  async verifyToken(rawToken: string): Promise<{ userId: string }> {
    const tokenHash = hashToken(rawToken);

    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.consumedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This verification link is invalid or has expired.');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
    ]);

    return { userId: record.userId };
  }
}
