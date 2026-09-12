import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { ChatModule } from '../chat/chat.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Phase 10 — platform moderation. Imports ChatModule (for the Redis-backed
 * ChatModerationService) and AuthModule (TokenService, to revoke a banned
 * user's sessions). AuditLogService + PrismaService are global.
 */
@Module({
  imports: [ChatModule, AuthModule],
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
