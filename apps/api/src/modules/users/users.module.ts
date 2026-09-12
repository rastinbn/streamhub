import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ChannelsModule } from '../channels/channels.module';
import { FollowsModule } from '../follows/follows.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ChannelsModule, FollowsModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
