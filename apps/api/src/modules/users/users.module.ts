import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [ChannelsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
