import { IsString, MinLength, MaxLength } from 'class-validator';
import { CHAT_MAX_MESSAGE_LENGTH } from '../chat.constants';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  streamId!: string;

  @IsString()
  @MinLength(1, { message: 'Message cannot be empty' })
  @MaxLength(CHAT_MAX_MESSAGE_LENGTH, {
    message: `Message cannot exceed ${CHAT_MAX_MESSAGE_LENGTH} characters`,
  })
  content!: string;
}
