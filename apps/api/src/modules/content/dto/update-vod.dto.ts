import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { VodVisibility } from '@streamhub/types';

/**
 * Runtime mirror of the `VodVisibility` string-literal union from
 * @streamhub/types (a type-only export — class-validator's `IsEnum` needs a
 * value object).
 */
export const VodVisibilityValue = {
  PUBLIC: 'PUBLIC',
  UNLISTED: 'UNLISTED',
  PRIVATE: 'PRIVATE',
} as const;

/** Owner-only PATCH body — storageKey/streamId/views are NOT client-editable. */
export class UpdateVodDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  thumbnail?: string | null;

  @IsOptional()
  @IsEnum(VodVisibilityValue)
  visibility?: VodVisibility;
}
