export interface WatchStream {
  title: string;
  viewerCount: string;
  duration: string;
  thumbnailUrl: string;
  thumbnailAlt: string;
  streamer: {
    name: string;
    avatarUrl: string;
    avatarAlt: string;
    followers: string;
    verified: boolean;
  };
  category: string;
  tags: string[];
  description: string;
}

export interface ChatMessage {
  id: string;
  type: 'mod' | 'subscriber' | 'user' | 'action' | 'notice';
  user?: string;
  userColor?: string;
  text: string;
}
