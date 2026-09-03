import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatModerationService } from './chat-moderation.service';

@Module({
  providers: [ChatGateway, ChatService, ChatModerationService],
  exports: [ChatModerationService],
})
export class ChatModule {}
