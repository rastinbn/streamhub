import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type RequestWithUser } from '../../common/guards/jwt-auth.guard';
import { MemesService } from './memes.service';
import { UploadMemeDto, UpdateMemeDto } from './dto/memes.dto';

/**
 * Meme sounds — REST surface for the owner-side management and the public
 * chat board listing. Playing happens over the chat socket (`chat:play-meme`
 * → `chat:meme`), because a play is a live chat-room event, not a CRUD op.
 */
@Controller('memes')
export class MemesController {
  constructor(private readonly memes: MemesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async upload(@Req() req: RequestWithUser, @Body() dto: UploadMemeDto) {
    return { success: true, data: await this.memes.upload(req.user.sub, dto) };
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async mine(@Req() req: RequestWithUser) {
    return { success: true, data: await this.memes.listMine(req.user.sub) };
  }

  /** Public board data for a channel's chat — active sounds only, no auth. */
  @Get('channels/:channelId')
  async forChannel(@Param('channelId') channelId: string) {
    return { success: true, data: await this.memes.listForChannel(channelId) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateMemeDto) {
    return { success: true, data: await this.memes.update(req.user.sub, id, dto) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    await this.memes.remove(req.user.sub, id);
    return { success: true, data: { deleted: true } };
  }
}
