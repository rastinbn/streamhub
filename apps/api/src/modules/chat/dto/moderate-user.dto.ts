import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ModerateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  streamId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  targetUserId!: string;
}

export class TimeoutUserDto extends ModerateUserDto {
  @IsInt()
  @Min(5)
  @Max(24 * 60 * 60) // 24h ceiling — anything longer should be a ban instead
  seconds!: number;
}
