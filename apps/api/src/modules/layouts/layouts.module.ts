import { Module } from '@nestjs/common';
import { ChannelLayoutsController } from './channel-layouts.controller';
import { MyLayoutsController } from './my-layouts.controller';
import { LayoutsService } from './layouts.service';

/**
 * Customizable Stream Page — layout persistence, validation, draft/publish
 * flows. `PrismaService` and `RedisService` are provided globally by the
 * Database/Redis modules, so no imports are needed here.
 */
@Module({
  controllers: [ChannelLayoutsController, MyLayoutsController],
  providers: [LayoutsService],
  exports: [LayoutsService],
})
export class LayoutsModule {}
