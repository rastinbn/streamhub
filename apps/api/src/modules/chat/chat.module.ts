import { Module } from '@nestjs/common';
import { PointsModule } from '../points/points.module';
import { MemesModule } from '../memes/memes.module';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatModerationService } from './chat-moderation.service';

/**
 * The gateway handles `chat:play-meme` via MemesService (spend + resolve)
 * and awards chat points via PointsService, so both feature modules are
 * imported here. MemesModule itself imports PointsModule, so the graph
 * stays acyclic.
 */
@Module({
  imports: [PointsModule, MemesModule],
  providers: [ChatGateway, ChatService, ChatModerationService],
  exports: [ChatModerationService],
})
export class ChatModule {}
