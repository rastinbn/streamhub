import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Global database module — exposes `PrismaService` to the whole API. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
