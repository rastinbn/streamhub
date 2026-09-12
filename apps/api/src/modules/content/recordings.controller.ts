import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ContentService } from './content.service';
import { RecordingCompletedDto } from './dto/recording-completed.dto';
import { MediaMtxWebhookGuard } from '../../common/guards/mediamtx-webhook.guard';

/**
 * Phase 9 — recording ingestion webhook. Authenticated with the same
 * shared secret as the live publish/unpublish hooks (MediaMtxWebhookGuard):
 * these calls come from MediaMTX, never from a user.
 */
@Controller('content')
export class RecordingsController {
  constructor(private readonly content: ContentService) {}

  @UseGuards(MediaMtxWebhookGuard)
  @Post('recordings/completed')
  async recordingCompleted(@Body() dto: RecordingCompletedDto) {
    const vod = await this.content.ingestRecording(dto);
    // Always 2xx: an unknown path or storage hiccup is logged for re-ingest,
    // never an error MediaMTX should retry into a loop.
    return { success: true, data: vod };
  }
}
