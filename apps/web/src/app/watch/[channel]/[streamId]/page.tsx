'use client';

import { useParams, useRouter, notFound } from 'next/navigation';
import VideoPlayer from '@/components/watch/VideoPlayer';
import StreamInfo from '@/components/watch/StreamInfo';
import ChatSidebar from '@/components/watch/ChatSidebar';
import type { WatchStream } from '@/components/watch/types';
import { useWatchStream } from '@/hooks/useWatchStream';
import { useAuth } from '@/lib/auth-context';
import { formatCompact, formatDuration } from '@/lib/format';
import {
  MISSING_NAME,
  PLACEHOLDER_ALT,
  PLACEHOLDER_AVATAR,
  PLACEHOLDER_THUMBNAIL,
  UNTITLED,
} from '@/lib/placeholders';

export default function WatchPage() {
  const params = useParams<{ channel: string; streamId: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { stream, channel, status, isFollowing, isLoading, isError, error, isNotFound, setFollowed } =
    useWatchStream(params.streamId, params.channel);

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

  const tags = Array.from(
    new Set([stream.category, channel?.category].filter((v): v is string => Boolean(v))),
  );

  const watchStream: WatchStream = {
    title: stream.title ?? UNTITLED,
    viewerCount: formatCompact(status?.viewerCount ?? stream.viewerCount),
    duration: formatDuration(status?.startedAt ?? stream.startedAt, status?.endedAt ?? stream.endedAt),
    thumbnailUrl: stream.thumbnail ?? channel?.banner ?? PLACEHOLDER_THUMBNAIL,
    thumbnailAlt: PLACEHOLDER_ALT,
    streamer: {
      name: channel?.name ?? MISSING_NAME,
      avatarUrl: channel?.avatar ?? PLACEHOLDER_AVATAR,
      avatarAlt: PLACEHOLDER_ALT,
      followers: channel ? formatCompact(channel.followersCount) : MISSING_NAME,
      verified: false,
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
      <ChatSidebar chat={[]} viewerCount={watchStream.viewerCount} />
    </div>
  );
}