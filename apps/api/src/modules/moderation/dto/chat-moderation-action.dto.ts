import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ChatModerationActionDto {
  /** timeout | ban | unban */
  @IsEnum(['timeout', 'ban', 'unban'])
  action!: 'timeout' | 'ban' | 'unban';

  @IsString()
  @MaxLength(64)
  channelId!: string;

  @IsString()
  @MaxLength(64)
  targetUserId!: string;

  /** Required for timeout (seconds), ignored otherwise. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  seconds?: number;
}
