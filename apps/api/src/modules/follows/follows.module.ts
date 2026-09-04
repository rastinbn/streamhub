import { Module } from '@nestjs/common';
import { FollowsService } from './follows.service';

/**
 * Phase 7 — Social & Discovery. No dedicated controller: the routes the
 * task specifies (`/channels/:id/follow`, `/channels/:id/followers`,
 * `/users/me/following`) live on `ChannelsController`/`UsersController`,
 * which import this module for `FollowsService` — the same pattern
 * `UsersModule` already uses for `ChannelsService` (see `me/channel`).
 */
@Module({
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
