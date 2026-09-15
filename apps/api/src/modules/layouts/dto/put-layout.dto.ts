import { Allow, IsObject } from 'class-validator';
import type { StreamPageLayoutDocument } from '@streamhub/types';

/**
 * Body for `PUT /users/me/channel/layout`. The envelope is a plain DTO so
 * the global ValidationPipe accepts it, but the `layout` field is untrusted
 * JSON — it is fully re-validated by `validateLayoutDocument` in the
 * service (widget types, bounds, duplicates, settings, limits).
 * class-validator cannot express those rules; the deep custom check in
 * `layout-validation.ts` IS the validation layer for the document itself.
 *
 * `@Allow()` whitelists the property (required — the global pipe runs with
 * `forbidNonWhitelisted`); `@IsObject()` gives fast-fail for the grossly
 * malformed case before the deep validator produces a precise message.
 */
export class PutLayoutDto {
  @Allow()
  @IsObject()
  layout!: StreamPageLayoutDocument;
}
