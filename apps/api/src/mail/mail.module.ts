import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Global mail module — exposes `MailService` to the whole API. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
