import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class ModerateUserDto {
  @IsString()
  @MinLength(1)
  streamId!: string;

  @IsString()
  @MinLength(1)
  targetUserId!: string;
}

export class TimeoutUserDto extends ModerateUserDto {
  @IsInt()
  @Min(5)
  @Max(24 * 60 * 60) // 24h ceiling — anything longer should be a ban instead
  seconds!: number;
}
