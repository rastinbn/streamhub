'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Heart, Bell, Radio, VideoOff, Share2, PenSquare } from 'lucide-react';
import { useChannelBySlug } from '@/hooks/useChannelBySlug';
import { useChannelLayout } from '@/hooks/useChannelLayout';
import { useAuth } from '@/lib/auth-context';
import { formatCompact } from '@/lib/format';
import { streamHlsUrl } from '@/lib/hls';
import { cn } from '@/lib/utils';
import type { WatchStream } from '@/components/watch/types';
import LayoutCanvas from '@/components/stream-page/LayoutCanvas';
import { cloneDefaultLayoutDocument } from '@/lib/default-layout';
import {
  MISSING_NAME,
  PLACEHOLDER_ALT,
  PLACEHOLDER_AVATAR,
  PLACEHOLDER_THUMBNAIL,
} from '@/lib/placeholders';

type Tab = 'Home' | 'About' | 'Videos' | 'Clips';
const TABS: Tab[] = ['Home', 'About', 'Videos', 'Clips'];

export default function ChannelPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const { channel, isLive, liveStream, isFollowing, isLoading, isError, error, isNotFound, setFollowed } =
    useChannelBySlug(slug);
  const { layout } = useChannelLayout(slug, !isLoading && !isError);
  const [notifyOn, setNotifyOn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Home');

  // NOTE: all hooks must run before the early returns below (rules-of-hooks).

  // The layout document to render: the channel's published layout, or the
  // safe default when there is none.
  const layoutDoc = useMemo(
    () => layout?.layout ?? cloneDefaultLayoutDocument(),
    [layout],
  );

  // Live view-model for the STREAM_PLAYER/CHAT widgets (same shape the
  // watch page builds; built only when this channel is live).
  const watchStream = useMemo(() => {
    if (!isLive || !liveStream || !channel) return null;
    return {
      title: liveStream.title ?? 'Untitled stream',
      viewerCount: formatCompact(liveStream.viewerCount),
      duration: '',
      thumbnailUrl: liveStream.thumbnail ?? channel.banner ?? PLACEHOLDER_THUMBNAIL,
      thumbnailAlt: PLACEHOLDER_ALT,
      hlsUrl: streamHlsUrl(liveStream.playbackPath),
      isLive: true,
      streamer: {
        name: channel.name,
        avatarUrl: channel.avatar ?? PLACEHOLDER_AVATAR,
        avatarAlt: PLACEHOLDER_ALT,
        followers: formatCompact(channel.followersCount),
      },
      category: liveStream.category ?? channel.category ?? MISSING_NAME,
      tags: [] as string[],
      description: liveStream.description ?? channel.description ?? '',
    } as WatchStream;
  }, [isLive, liveStream, channel]);

  async function toggleFollow() {
    if (!channel || !accessToken) {
      router.push('/login');
      return;
    }
    await setFollowed(!isFollowing);
  }

  if (isNotFound) notFound();

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading channel…</p>
      </div>
    );
  }

  if (isError || !channel) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <p role="alert" className="text-body-md font-body-md text-error">
          {error ?? 'Channel not found.'}
        </p>
      </div>
    );
  }

  const bannerUrl = channel.banner ?? PLACEHOLDER_THUMBNAIL;
  const avatarUrl = channel.avatar ?? PLACEHOLDER_AVATAR;
  const bio = channel.description ?? MISSING_NAME;
  const followers = formatCompact(channel.followersCount);
  const isOwner = Boolean(user && channel && user.id === channel.ownerId);

  return (
    <div className="relative bg-surface-container-lowest">
      <div className="relative h-48 w-full overflow-hidden border-b border-outline-variant/20 bg-surface-container md:h-64">
        <Image
          src={bannerUrl}
          alt={channel.banner ? `${channel.name} banner` : PLACEHOLDER_ALT}
          fill
          priority
          className="object-cover opacity-80"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent opacity-90" />
      </div>


      <div className="relative z-10 mx-auto -mt-44 flex max-w-7xl flex-col gap-md border-b border-outline-variant/20 px-layout-gutter pb-md sm:-mt-36 sm:flex-row sm:items-end sm:justify-between md:px-layout-margin">
        <div className="flex items-end gap-md sm:gap-lg">
          <div className="relative h-24 w-24 shrink-0 rounded-full bg-surface-container-lowest p-1 shadow-lg ring-2 ring-outline-variant/50 sm:h-32 sm:w-32">
            <Image
              src={avatarUrl}
              alt={`${channel.name} avatar`}
              fill
              className="rounded-full object-cover grayscale-[20%]"
            />
            <span
              aria-label={isLive ? 'Live' : 'Offline'}
              className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-surface-container-lowest bg-surface-variant sm:h-6 sm:w-6"
            />
          </div>

          <div className="pb-1 sm:pb-2">
            <div className="flex items-center gap-xs">
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
                {channel.name}
              </h1>
              <BadgeCheck className="h-5 w-5 fill-primary text-surface" />
            </div>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              {followers} Followers
            </p>
            <p className="mt-sm hidden max-w-xl font-body-md text-body-md text-on-surface sm:block">
              {bio}
            </p>
          </div>
        </div>


        <div className="mt-sm flex w-full items-center gap-sm sm:mt-0 sm:w-auto sm:pb-2">
          {isOwner && (
            <Link
              href="/dashboard/channel/layout"
              className="flex h-10 items-center gap-xs rounded-DEFAULT border border-outline-variant/30 bg-surface-container px-sm text-label-md text-on-surface transition-colors hover:border-primary hover:text-primary"
              aria-label="Customize this page"
            >
              <PenSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Customize</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => void toggleFollow()}
            aria-pressed={isFollowing}
            className={cn(
              'flex flex-1 items-center justify-center gap-xs rounded-DEFAULT px-lg py-sm text-label-md font-label-md transition-colors duration-150 active:scale-95 sm:flex-none',
              isFollowing
                ? 'border border-outline-variant/30 bg-surface-container text-on-surface hover:bg-surface-container-high'
                : 'bg-primary text-on-primary shadow-md shadow-primary/20 hover:bg-primary-fixed',
            )}
          >
            <Heart className="h-[18px] w-[18px]" fill={isFollowing ? 'currentColor' : 'none'} />
            {isFollowing ? 'Following' : 'Follow'}
          </button>

          <button
            type="button"
            onClick={() => setNotifyOn((v) => !v)}
            aria-pressed={notifyOn}
            aria-label={notifyOn ? 'Turn off notifications' : 'Turn on notifications'}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-DEFAULT border border-outline-variant/30 p-sm transition-colors duration-150 active:scale-95',
              notifyOn
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container text-on-surface hover:bg-surface-container-high',
            )}
          >
            <Bell className="h-5 w-5" fill={notifyOn ? 'currentColor' : 'none'} />
          </button>


          <div className="ml-xs flex h-8 items-center gap-xs border-l border-outline-variant/30 pl-sm">
            <button
              type="button"
              aria-label="Share channel"
              className="p-1 text-on-surface-variant transition-colors hover:text-primary"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <p className="block px-layout-gutter pt-sm font-body-md text-body-md text-on-surface sm:hidden">
        {bio}
      </p>

      <div className="no-scrollbar mx-auto mt-md max-w-7xl overflow-x-auto border-b border-outline-variant/20 px-layout-gutter sm:mt-lg md:px-layout-margin">
        <ul className="flex min-w-max gap-lg">
          {TABS.map((tab) => (
            <li key={tab}>
              <button
                type="button"
                onClick={() => setActiveTab(tab)}
className={cn(
                'relative cursor-pointer py-md text-label-md font-label-md transition-colors',
                activeTab === tab
                  ? "text-primary after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:content-['']"
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
              >
                {tab}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto max-w-7xl px-layout-gutter py-lg sm:py-xl md:px-layout-margin">
        {activeTab !== 'Home' ? (
          <div className="flex flex-col items-center justify-center gap-sm rounded-xl border border-dashed border-outline-variant py-2xl text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              {activeTab} isn&#39;t wired up yet — no data source for it so far.
            </p>
          </div>
        ) : (
          <LayoutCanvas
            layout={layoutDoc}
            channel={channel}
            context="public"
            stream={watchStream}
            liveStreamId={isLive && liveStream ? liveStream.id : null}
            viewerCount={watchStream?.viewerCount ?? formatCompact(liveStream?.viewerCount ?? 0)}
            channelId={channel.id}
          />
        )}
      </div>
    </div>
  );
}