import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { StreamsModule } from './modules/streams/streams.module';
import { ChatModule } from './modules/chat/chat.module';
import { FollowsModule } from './modules/follows/follows.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    // Domain modules (placeholders for now, implemented phase by phase):
    AuthModule,
    UsersModule,
    ChannelsModule,
    StreamsModule,
    ChatModule,
    FollowsModule,
    NotificationsModule,
    ModerationModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
