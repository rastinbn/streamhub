import { Controller, Get, Param } from '@nestjs/common';
import { LayoutsService } from './layouts.service';

/**
 * Public layout endpoints. `GET /channels/:slug/layout` feeds the public
 * channel page; it exposes only the PUBLISHED layout (or the default) and
 * no draft state. No authentication — this is what visitors render.
 */
@Controller('channels')
export class ChannelLayoutsController {
  constructor(private readonly layouts: LayoutsService) {}

  @Get(':slug/layout')
  async getPublished(@Param('slug') slug: string) {
    return { success: true, data: await this.layouts.getPublishedBySlug(slug) };
  }
}
