import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

/** Body for the MediaMTX record-complete webhook (shared-secret guarded). */
export class RecordingCompletedDto {
  /** MediaMTX path — we publish under the raw stream key, so this IS the key. */
  @IsString()
  @MinLength(1)
  path!: string;

  /** Absolute path of the finished recording on the MediaMTX host. */
  @IsString()
  @MinLength(1)
  filePath!: string;

  /** Recording duration in seconds (when the hook provides it). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  duration?: number;
}
