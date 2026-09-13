'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter, notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import VideoPlayer from '@/components/watch/VideoPlayer';
import StreamInfo from '@/components/watch/StreamInfo';
import WatchGate from '@/components/watch/WatchGate';
import ChatFeed from '@/components/watch/ChatFeed';
import ChatComposer from '@/components/watch/ChatComposer';
import type { WatchStream } from '@/components/watch/types';
import { useWatchStream } from '@/hooks/useWatchStream';
import { useWatchChat } from '@/hooks/useWatchChat';
import { useViewerHeartbeat } from '@/hooks/useViewerHeartbeat';
import { useAuth } from '@/lib/auth-context';
import { formatCompact, formatDuration } from '@/lib/format';
import { streamHlsUrl } from '@/lib/hls';
import { Info, MessageSquare, Clapperboard, Star, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

  const [tab, setTab] = useState<'chat' | 'about' | 'clips'>('chat');

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

  const isLive = stream.status === 'LIVE';

  const watchStream: WatchStream = {
    title: stream.title ?? UNTITLED,
    viewerCount: formatCompact(chat.liveViewerCount ?? status?.viewerCount ?? stream.viewerCount),
    duration: formatDuration(status?.startedAt ?? stream.startedAt, status?.endedAt ?? stream.endedAt),
    thumbnailUrl: stream.thumbnail ?? channel?.banner ?? PLACEHOLDER_THUMBNAIL,
    thumbnailAlt: PLACEHOLDER_ALT,
    hlsUrl: isLive ? streamHlsUrl(stream.playbackPath) : null,
    isLive,
    streamer: {
      name: channel?.name ?? MISSING_NAME,
      avatarUrl: channel?.avatar ?? PLACEHOLDER_AVATAR,
      avatarAlt: PLACEHOLDER_ALT,
      followers: channel ? formatCompact(chat.liveFollowersCount ?? channel.followersCount) : MISSING_NAME,
      verified: false,
    },
    category: stream.category ?? channel?.category ?? MISSING_NAME,
    tags,
    description: stream.description ?? channel?.description ?? '',
  };

  const labels: { tab: 'chat' | 'about' | 'clips'; label: string; icon: LucideIcon }[] = [
    { tab: 'chat', label: 'Live Chat', icon: MessageSquare },
    { tab: 'about', label: 'About', icon: Info },
    { tab: 'clips', label: 'Clips', icon: Clapperboard },
  ];

  const chatProps = {
    chat: chat.messages,
    viewerCount: watchStream.viewerCount,
    connectionStatus: chat.status,
    requiresAuth: chat.requiresAuth,
    errorMessage: chat.errorMessage,
    onSend: chat.send,
    onClearError: chat.clearError,
  };

  return (
    <>
      {/* Mobile & tablet (<lg) — pinned video, meta, tabs, chat/about/clips */}
      <div className="flex h-[calc(100vh-8rem)] flex-col lg:hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Pinned edge-to-edge player */}
          <div className="sticky top-0 z-30 aspect-video w-full shrink-0 bg-black">
            <VideoPlayer stream={watchStream} />
          </div>

          {/* Title + creator meta + tags */}
          <div className="border-b border-outline-variant/30 bg-surface-container-low px-md py-md">
            <h1 className="truncate font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
              {watchStream.title}
            </h1>

            <div className="mt-md flex items-center justify-between gap-md">
              <div className="flex min-w-0 items-center gap-sm">
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-error via-primary to-secondary">
                    <div className="w-full h-full rounded-full bg-surface-container-lowest overflow-hidden">
                      <Image
                        className="w-full h-full rounded-full object-cover"
                        src={watchStream.streamer.avatarUrl}
                        alt={watchStream.streamer.avatarAlt}
                        width={44}
                        height={44}
                      />
                    </div>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-live ring-2 ring-surface-container" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="truncate font-label-md text-label-md font-bold text-on-surface">
                      {watchStream.streamer.name}
                    </span>
                    {watchStream.streamer.verified && (
                      <Star className="h-[16px] w-[16px] fill-primary text-primary" />
                    )}
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {watchStream.streamer.followers} Followers
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-xs">
                <button
                  type="button"
                  onClick={() => void toggleFollow()}
                  aria-pressed={isFollowing}
                  className="flex items-center gap-1.5 rounded-full bg-primary-container px-md py-sm font-label-md text-label-md font-bold text-on-primary-container shadow-sm transition-transform active:scale-95"
                >
                  <Heart className="h-[16px] w-[16px]" fill={isFollowing ? 'currentColor' : 'none'} />
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-full border border-outline px-md py-sm font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-variant"
                >
                  <Star className="h-[16px] w-[16px]" />
                  Sub
                </button>
              </div>
            </div>

            <div className="no-scrollbar mt-md flex gap-sm overflow-x-auto">
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-surface-variant bg-surface-container-high px-3 py-1.5 font-label-sm text-label-sm text-primary">
                {watchStream.category}
              </span>
              {watchStream.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex shrink-0 items-center rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Sticky segmented tabs pinned right under the video */}
          <div className="sticky top-[56.25vw] z-20 flex items-center gap-xs border-b border-outline-variant/30 bg-surface/95 px-md backdrop-blur">
            {labels.map(({ tab: id, label, icon: Icon }) => {
              const isActive = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-3 font-label-md text-label-md transition-colors ${
                    isActive
                      ? 'border-primary font-semibold text-on-surface'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-primary' : ''}`} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {tab === 'chat' && <ChatFeed {...chatProps} variant="mobile" />}
          {tab === 'about' && (
            <div className="flex flex-col gap-md px-md py-md">
              <p className="whitespace-pre-line font-body-md text-body-md leading-relaxed text-on-surface-variant">
                {watchStream.description ||
                  'No description provided by the streamer.'}
              </p>
            </div>
          )}
          {tab === 'clips' && (
            <div className="flex flex-col items-center justify-center gap-sm px-md py-2xl text-center">
              <Clapperboard className="h-8 w-8 text-outline" />
              <p className="font-body-md text-body-md text-on-surface-variant">
                No clips yet — highlights will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Pinned composer (chat tab only) */}
        {tab === 'chat' && (
          <ChatComposer
            isConnected={chat.status === 'connected'}
            onSend={chat.send}
            errorMessage={chat.errorMessage}
            onClearError={chat.clearError}
            variant="mobile"
          />
        )}
      </div>

      {/* Desktop (lg+) — player + info with a chat sidebar */}
      <div className="hidden h-[calc(100vh-4rem)] lg:flex">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-md pb-xl lg:p-lg">
          <div className="mx-auto w-full max-w-screen-2xl space-y-lg">
            <VideoPlayer stream={watchStream} />
            <StreamInfo stream={watchStream} isFollowing={isFollowing} onFollow={() => void toggleFollow()} />
          </div>
        </div>

        {/* Chat sidebar */}
        <ChatSidebar {...chatProps} />
      </div>
    </>
  );
}