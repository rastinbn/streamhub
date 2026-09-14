'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import VideoPlayer from '@/components/watch/VideoPlayer';
import StreamInfo from '@/components/watch/StreamInfo';
import WatchGate from '@/components/watch/WatchGate';
import type { WatchStream } from '@/components/watch/types';
import { useWatchStream } from '@/hooks/useWatchStream';
import { useWatchChat } from '@/hooks/useWatchChat';
import { useViewerHeartbeat } from '@/hooks/useViewerHeartbeat';
import { useAuth } from '@/lib/auth-context';
import { formatCompact, formatDuration } from '@/lib/format';
import { streamHlsUrl } from '@/lib/hls';
import {
  MISSING_NAME,
  PLACEHOLDER_ALT,
  PLACEHOLDER_AVATAR,
  PLACEHOLDER_THUMBNAIL,
  UNTITLED,
} from '@/lib/placeholders';

// Chat spawns a socket connection on mount, so keep it out of the initial
// chunk and only mount it client-side once the player region has painted.
const ChatSidebar = dynamic(() => import('@/components/watch/ChatSidebar'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-low p-lg text-on-surface-variant">
      <p className="text-label-sm font-label-sm uppercase tracking-wide">Loading chat…</p>
    </div>
  ),
});

export default function WatchPage() {
  const params = useParams<{ channel: string; streamId: string }>();
  const router = useRouter();
  const { user, loading, accessToken } = useAuth();
  const { stream, channel, status, isFollowing, isLoading, isError, error, isNotFound, setFollowed } =
    useWatchStream(params.streamId, params.channel);
  const chat = useWatchChat(params.streamId);
  // Signed-out visitors don't send presence pings — only authenticated
  // viewers count toward a stream's live viewer number.
  useViewerHeartbeat(params.streamId, stream?.status === 'LIVE' && !isLoading && !!user && !loading);

  // Realtime clock: while the broadcast is LIVE, tick every second so the
  // stream time below counts up live (viewer count already streams in over
  // the chat socket via `liveViewerCount`).
  const isLive = stream?.status === 'LIVE';
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isLive]);

  async function toggleFollow() {
    if (!stream || !accessToken) {
      router.push('/login');
      return;
    }
    await setFollowed(!isFollowing);
  }

  if (isNotFound) notFound();

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading stream…</p>
      </div>
    );
  }

  if (isError || !stream) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <p role="alert" className="text-body-md font-body-md text-error">
          {error ?? 'Stream not found.'}
        </p>
      </div>
    );
  }

  // Watching requires an account: signed-out visitors get the login/signup
  // gate in place of the player and chat.
  if (!user) {
    return <WatchGate returnTo={`/watch/${params.channel}/${params.streamId}`} />;
  }

  const tags = Array.from(
    new Set([stream.category, channel?.category].filter((v): v is string => Boolean(v))),
  );

  const watchStream: WatchStream = {
    title: stream.title ?? UNTITLED,
    viewerCount: formatCompact(chat.liveViewerCount ?? status?.viewerCount ?? stream.viewerCount),
    duration: formatDuration(
      status?.startedAt ?? stream.startedAt,
      // Live broadcasts count up to the tick's "now"; ended ones freeze at
      // their endedAt.
      isLive ? new Date(now).toISOString() : (status?.endedAt ?? stream.endedAt),
    ),
    thumbnailUrl: stream.thumbnail ?? channel?.banner ?? PLACEHOLDER_THUMBNAIL,
    thumbnailAlt: PLACEHOLDER_ALT,
    hlsUrl: isLive ? streamHlsUrl(stream.playbackPath) : null,
    isLive,
    streamer: {
      name: channel?.name ?? MISSING_NAME,
      avatarUrl: channel?.avatar ?? PLACEHOLDER_AVATAR,
      avatarAlt: PLACEHOLDER_ALT,
      followers: channel ? formatCompact(chat.liveFollowersCount ?? channel.followersCount) : MISSING_NAME,
    },
    category: stream.category ?? channel?.category ?? MISSING_NAME,
    tags,
    description: stream.description ?? channel?.description ?? '',
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-md lg:p-lg pb-xl">
        <div className="max-w-screen-2xl mx-auto w-full space-y-lg">
          <VideoPlayer stream={watchStream} />
          <StreamInfo stream={watchStream} isFollowing={isFollowing} onFollow={() => void toggleFollow()} />
        </div>
      </div>

      {/* Chat sidebar */}
      <ChatSidebar
        chat={chat.messages}
        viewerCount={watchStream.viewerCount}
        connectionStatus={chat.status}
        requiresAuth={chat.requiresAuth}
        errorMessage={chat.errorMessage}
        onSend={chat.send}
        onClearError={chat.clearError}
      />
    </div>
  );
}