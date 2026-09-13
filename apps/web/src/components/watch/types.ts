export interface WatchStream {
  title: string;
  viewerCount: string;
  duration: string;
  thumbnailUrl: string;
  thumbnailAlt: string;
  /** Absolute HLS master playlist URL; null when the stream is not live. */
  hlsUrl?: string | null;
  isLive: boolean;
  streamer: {
    name: string;
    avatarUrl: string;
    avatarAlt: string;
    followers: string;
  };
  category: string;
  tags: string[];
  description: string;
}

export interface ChatMessage {
  id: string;
  type: 'mod' | 'subscriber' | 'user' | 'action' | 'notice';
  user?: string;
  /** Authenticated author id from the backend — used for moderator actions. */
  userId?: string;
  userColor?: string;
  text: string;
}
