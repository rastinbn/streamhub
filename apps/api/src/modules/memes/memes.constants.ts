import type { MemeAudioFormat } from '@streamhub/types';

/** Hard per-file cap for meme sounds — they're short clips, not songs. */
export const MAX_MEME_BYTES = 512 * 1024; // 512 KB

export const MEME_MIME_BY_FORMAT: Record<MemeAudioFormat, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
};
